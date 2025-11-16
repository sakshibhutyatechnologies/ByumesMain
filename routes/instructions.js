const express = require('express');
const router = express.Router();
const Instruction = require('../models/instructionModel');

// Get a specific instruction by ID
router.get('/:id', async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id).select('_id instruction_name current_step current_qa_step current_index');
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }
    res.status(200).json(instruction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/current-step', async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    res.status(200).json({ current_step: instruction.current_step });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/current-qa-step', async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    res.status(200).json({ current_qa_step: instruction.current_qa_step });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update current step
router.patch('/:id/current-step', async (req, res) => {
  const { current_step } = req.body;

  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    // Update current step
    instruction.current_step = current_step;

    await instruction.save();
    res.status(200).json(instruction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

// Update current QA step
router.patch('/:id/current-qa-step', async (req, res) => {
  const { current_qa_step } = req.body; // Correctly getting current_qa_step from body

  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    // Update current QA step
    instruction.current_qa_step = current_qa_step; // Correctly updating current_qa_step

    await instruction.save();
    res.status(200).json(instruction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get a specific step by instruction ID and step number
router.get('/:id/step/:stepNumber', async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    const step = instruction.instructions.find(instr => instr.step === parseInt(req.params.stepNumber));
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    res.status(200).json(step);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a specific step by instruction ID and step number
router.patch('/:id/step/:stepNumber', async (req, res) => {
  const { id, stepNumber } = req.params;
  const { updatedStepData } = req.body; // Data to update the step

  try {
    const instruction = await Instruction.findById(id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    // Find the index of the step to update
    const stepIndex = instruction.instructions.findIndex(instr => instr.step === parseInt(stepNumber));
    if (stepIndex === -1) {
      return res.status(404).json({ message: 'Step not found' });
    }

    // Update the step at the found index
    instruction.instructions[stepIndex] = { ...instruction.instructions[stepIndex], ...updatedStepData };

    await instruction.save();
    res.status(200).json(instruction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get total number of steps
router.get('/:id/total-steps', async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    const totalSteps = instruction.instructions.length;
    res.status(200).json({ totalSteps });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const recalculateAutoPlaceholders = async (instruction, newInputValues = inputValues) => {
  try {
    // Track all placeholders and ensure only relevant ones are updated
    const allPlaceholders = new Set();
    const updatedPlaceholders = new Set(newInputValues.map(item => item.key));

    // First, gather all placeholders across instructions
    for (let inst of instruction.instructions) {
      if (inst.placeholders) {
        const placeholders = inst.placeholders instanceof Map
          ? Array.from(inst.placeholders.entries())
          : Object.entries(inst.placeholders);

        for (let [key, placeholderData] of placeholders) {
          allPlaceholders.add(key); // Collect all placeholder keys
        }
      }
    }

    // Iterate over instructions to evaluate formulas
    for (let inst of instruction.instructions) {
      if (inst.placeholders) {
        const placeholders = inst.placeholders instanceof Map
          ? Array.from(inst.placeholders.entries())
          : Object.entries(inst.placeholders);

        for (let [key, placeholderData] of placeholders) {
          if (typeof placeholderData === 'object' && placeholderData.formula) {
            try {
              const formula = placeholderData.formula;

              // Extract keys from formula and check if any of these keys are in updatedPlaceholders
              const formulaKeys = formula.match(/\{([^}]*)\}/g).map(f => f.replace(/[{}]/g, ''));
              const isRelevant = formulaKeys.some(fk => updatedPlaceholders.has(fk));

              if (isRelevant) {
                // Replace placeholders in the formula with values from newInputValues, but keep existing if undefined
                const evaluatedValue = eval(
                  formula.replace(/\{([^}]*)\}/g, (_, placeholderKey) => {
                    const value = getPlaceholderValue(placeholderKey, newInputValues, inst);
                    return value !== undefined && value !== '' ? value : `{${placeholderKey}}`; // Keep the placeholder intact if not found
                  })
                );

                // Update the placeholder value with the calculated result
                placeholderData.value = evaluatedValue;
                newInputValues[key] = evaluatedValue;

                instruction.markModified('instructions');
              }
            } catch (e) {
              console.error(`Error evaluating formula for key ${key}:`, e);
            }
          } else if (updatedPlaceholders.has(key)) {
            // Update placeholders that are directly found in newInputValues, preserving existing values if necessary
            const newValue = newInputValues[key] !== undefined ? newInputValues[key] : placeholderData.value;
            placeholderData.value = newValue;
          }
        }
      }
    }

    // Return updated instruction
    return instruction;
  } catch (error) {
    console.error('Error recalculating and saving placeholders:', error);
  }
};

const getPlaceholderValue = (placeholderKey, newInputValues, instruction) => {
  const input = newInputValues.find(item => item.key === placeholderKey);
  if (input) {
    return input.value;
  }

  for (let inst of instruction.instructions) {
    if (inst.placeholders && inst.placeholders[placeholderKey]) {
      return inst.placeholders[placeholderKey].value;
    }
  }

  return undefined;
};


router.patch('/:id/input-values', async (req, res) => {
  const { inputValues } = req.body;

  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    inputValues.forEach(input => {
      const stepToUpdate = instruction.instructions.find(instr => {
        return (
          instr.has_placeholder &&
          Object.keys(instr.placeholders).includes(input.key)
        );
      });

      if (stepToUpdate && stepToUpdate.operator_execution?.executed === false) {
        stepToUpdate.placeholders[input.key].value = input.value;
      }
    });

    const result = await recalculateAutoPlaceholders(instruction, inputValues);
    await result.save();
    
    res.status(200).json(instruction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const { instruction_name, instructions } = req.body;

  const masterInstruction = new Instruction({
      instruction_name,
      instructions,
      current_step: 1, 
      current_qa_step: 1
  });

  try {
      // Save the master instruction to the database
      const newInstruction = await masterInstruction.save();
      res.status(201).json({ instruction_id: newInstruction._id }); // Return the new instruction ID
  } catch (err) {
      console.error('Error creating master instruction:', err);
      res.status(400).json({ message: err.message });
  }
});

// Get total number of steps
router.get('/:id/total-steps', async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) {
      return res.status(404).json({ message: 'Instruction not found' });
    }

    const totalSteps = instruction.instructions.length;
    res.status(200).json({ totalSteps });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;