import mongoose from 'mongoose';  
import dotenv from 'dotenv';  

dotenv.config();  

const connectDB = async () => {  
  try {  
    console.log('Connecting to MongoDB with URI:', process.env.MONGO_URI);  
    await mongoose.connect(process.env.MONGO_URI, {  
      connectTimeoutMS: 50000,   
    });  
    console.log('MongoDB connected successfully');  
  } catch (error) {  
    console.error('MongoDB connection error:', error.message);  
    process.exit(1);  
  }  
};  

export default connectDB;