// index.js
import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import markerRoutes from './routes/markerRoutes.js';
import regionMapRoutes from './routes/regionMapRoutes.js';
import cors from 'cors'




const app = express();
dotenv.config()




const connectDB = async() => {
    try{
        console.log(process.env.MONGO_URI)
        await mongoose.connect('mongodb://localhost:27017/safet')
        console.log(`connected to ${mongoose.connection.host}`)
    }catch(err)
    {
        console.log(`${err} in connecting`)
    }
}

app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));
app.use(cookieParser())
app.use(express.json())

app.use('/api/region', regionMapRoutes);
// app.use('/api/markers', markerRoutes); // Use marker routes

connectDB()
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

