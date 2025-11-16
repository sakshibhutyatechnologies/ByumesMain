const configuration = {
    development: {
    //  MONGO_URI: "mongodb://localhost:27017/testDatabase",
      MONGO_URI: process.env.MONGO_URI_DEV || process.env.MONGO_URI,      
    },
    qa: {
     // MONGO_URI: "mongodb://localhost:27017/qaDatabase",
        MONGO_URI: process.env.MONGO_URI_QA || process.env.MONGO_URI,
    },
    production: {
     // MONGO_URI: "mongodb://production-db-uri:27017/productionDatabase",
        MONGO_URI: process.env.MONGO_URI_PROD || process.env.MONGO_URI,        
    },
  };

  const ENV = process.env.APP_ENV || "development"; 
  
  module.exports = configuration[ENV]; 
