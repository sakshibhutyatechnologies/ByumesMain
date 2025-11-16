const express = require('express');
const router = express.Router();
const EquipmentActivities = require('../models/equipmentActivitiesModel');

// Get a specific equipment activity by ID
router.get('/:id', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id).select('_id activity_name current_step current_qa_step');
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/current-step', async (req, res) => {
  try {
    const equipmentActivities = await EquipmentActivities.findById(req.params.id);
    if (!equipmentActivities) {
      return res.status(404).json({ message: 'equipmentActivities not found' });
    }

    res.status(200).json({ current_step: equipmentActivities.current_step });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/current-qa-step', async (req, res) => {
  try {
    const equipmentActivities = await EquipmentActivities.findById(req.params.id);
    if (!equipmentActivities) {
      return res.status(404).json({ message: 'equipmentActivities not found' });
    }

    res.status(200).json({ current_qa_step: equipmentActivities.current_qa_step });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update current step
router.patch('/:id/current-step', async (req, res) => {
  const { current_step } = req.body;

  try {
    const equipmentActivities = await EquipmentActivities.findById(req.params.id);
    if (!equipmentActivities) {
      return res.status(404).json({ message: 'equipmentActivities not found' });
    }

    // Update current step
    equipmentActivities.current_step = current_step;

    await equipmentActivities.save();
    res.status(200).json(equipmentActivities);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update current QA step
router.patch('/:id/current-qa-step', async (req, res) => {
  const { current_qa_step } = req.body; // Correctly getting current_qa_step from body

  try {
    const equipmentActivities = await EquipmentActivities.findById(req.params.id);
    if (!equipmentActivities) {
      return res.status(404).json({ message: 'equipmentActivities not found' });
    }

    // Update current QA step
    equipmentActivities.current_qa_step = current_qa_step; // Correctly updating current_qa_step

    await equipmentActivities.save();
    res.status(200).json(equipmentActivities);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get a specific step by activity ID and step number
router.get('/:id/step/:stepNumber', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }

    const step = activity.activities.find(a => a.step === parseInt(req.params.stepNumber));
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    res.status(200).json(step);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a specific step by activity ID and step number
router.patch('/:id/step/:stepNumber', async (req, res) => {
  const { id, stepNumber } = req.params;
  const { updatedStepData } = req.body;

  try {
    const activity = await EquipmentActivities.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }

    const stepIndex = activity.activities.findIndex(a => a.step === parseInt(stepNumber));
    if (stepIndex === -1) {
      return res.status(404).json({ message: 'Step not found' });
    }

    activity.activities[stepIndex] = { ...activity.activities[stepIndex], ...updatedStepData };

    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update placeholders for a specific step
router.patch('/:id/step/:stepNumber/placeholders', async (req, res) => {
  const { id, stepNumber } = req.params;
  const { placeholders } = req.body;

  try {
    const activity = await EquipmentActivities.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }

    const step = activity.activities.find(a => a.step === parseInt(stepNumber));
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    step.placeholders = placeholders;

    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get total number of steps in an activity
router.get('/:id/total-steps', async (req, res) => {
  try {
    const activity = await EquipmentActivities.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }

    const totalSteps = activity.activities.length;
    res.status(200).json({ totalSteps });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Create a new equipment activity
router.post('/', async (req, res) => {
  const { product_name, activity_name, activities } = req.body;

  const newActivity = new EquipmentActivities({
    product_name,
    activity_name, 
    activities, 
    current_step: 1,
    current_qa_step: 1
  });

  try {
      const savedActivity = await newActivity.save();
    res.status(201).json({ activity_id: savedActivity._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update operator execution details for a step
router.patch('/:id/step/:stepNumber/operator-execution', async (req, res) => {
  const { id, stepNumber } = req.params;
  const { executed, executed_by, executed_at } = req.body;

  try {
    const activity = await EquipmentActivities.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }

    const step = activity.activities.find(a => a.step === parseInt(stepNumber));
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    step.operator_execution = { executed, executed_by, executed_at };

    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add a comment to a specific step
router.post('/:id/step/:stepNumber/comments', async (req, res) => {
  const { id, stepNumber } = req.params;
  const { user, text } = req.body;

  try {
    const activity = await EquipmentActivities.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'Equipment activity not found' });
    }

    const step = activity.activities.find(a => a.step === parseInt(stepNumber));
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    step.comments.push({ user, text });

    await activity.save();
    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/input-values', async (req, res) => {
  const { inputValues } = req.body;

  try {
    const equipmentActivities = await EquipmentActivities.findById(req.params.id);
    if (!equipmentActivities) {
      return res.status(404).json({ message: ' Equipment Activity not found' });
    }

    inputValues.forEach(input => {
      const stepToUpdate = equipmentActivities.activities.find(instr => {
        return (
          instr.has_placeholder &&
          Object.keys(instr.placeholders).includes(input.key)
        );
      });

      if (stepToUpdate && stepToUpdate.operator_execution?.executed === false) {
        stepToUpdate.placeholders[input.key].value = input.value;
      }
    });

    const result = await recalculateAutoPlaceholders(equipmentActivities, inputValues);
    await result.save();
    
    res.status(200).json(equipmentActivities);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const recalculateAutoPlaceholders = async (equipmentActivities, newInputValues = inputValues) => {
  try {
    // Track all placeholders and ensure only relevant ones are updated
    const allPlaceholders = new Set();
    const updatedPlaceholders = new Set(newInputValues.map(item => item.key));

    // First, gather all placeholders across activities
    for (let inst of equipmentActivities.activities) {
      if (inst.placeholders) {
        const placeholders = inst.placeholders instanceof Map
          ? Array.from(inst.placeholders.entries())
          : Object.entries(inst.placeholders);

        for (let [key, placeholderData] of placeholders) {
          allPlaceholders.add(key); // Collect all placeholder keys
        }
      }
    }

    // Iterate over activities to evaluate formulas
    for (let inst of equipmentActivities.activities) {
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

                equipmentActivities.markModified('activities');
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

    // Return updated equipmentActivities
    return equipmentActivities;
  } catch (error) {
    console.error('Error recalculating and saving placeholders:', error);
  }
};

module.exports = router;