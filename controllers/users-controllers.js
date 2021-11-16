const HttpError = require("../models/http-error");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

// const DUMMY_USERS = [
//   {
//     id: "u1",
//     name: "Petri K",
//     email: "test@test.com",
//     password: "testpass",
//   },
// ];

const getUsers = async (req, res, next) => {
  // res.json({ users: DUMMY_USERS });
  let users;
  // const { email, name } = req.body;

  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(new HttpError("Cant fetch users", 500));
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passewd, please check your data", 422)
    );
  }
  //places
  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    return next(new HttpError("Singing up failed, try again later", 500));
  }

  if (existingUser) {
    const error = new HttpError("User exists already, please login", 422);
    return next(error);
  }

  let hashedPassword;

  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "Could not create user, please try again",
      500
    );
    return next(error);
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: [],
  });

  // DUMMY_USERS.push(createdUser);

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError(
      "Signing up failed, please try again later",
      500
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError(
      "Signing up failed, please try again later",
      500
    );
    return next(error);
  }

  res.status(201).json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  // const identifiedUser = DUMMY_USERS.find((u) => email === email);
  // if (!identifiedUser || identifiedUser.password !== password) {
  //   return next(new HttpError("Could not identify user", 401));
  // }

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    return next(new HttpError("Logging in failed, try again later", 500));
  }

  if (!existingUser) {
    const error = new HttpError("Invalid credentials", 401);
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError("Could not log you in", 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError("Invalid credentials", 401);
    return next(error);
  }

  //jwt token creation
  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
       process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError(
      "Logging in failed, please try again later",
      500
    );
    return next(error);
  }


  res.json({
   userId: existingUser.id,
   email: existingUser.email,
   token: token
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
