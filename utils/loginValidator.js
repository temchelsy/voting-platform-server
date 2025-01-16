import joi from 'joi';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const loginSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});

const loginValidator = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    console.log("Validation error:", error.details); 
    return res.status(400).json({ status: 'error', message: error.details[0].message });
  }
  next();
};

export default loginValidator