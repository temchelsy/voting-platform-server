import joi from 'joi';

const registerSchema = joi.object({
    username: joi.string().min(4).max(30).required(),
    password: joi.string().min(8).max(30).required(),
    email: joi.string().email().required()
});

const registerValidator = (req, res, next) => {
    const { error } = registerSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ status: 'error', message: error.details[0].message });
    }
    next();
};

export default registerValidator