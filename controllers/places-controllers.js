const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const { validationResult } = require("express-validator");
const getCoordsForAddress = require("../util/location");
const mongoose = require("mongoose");
const Place = require("../models/place");
const User = require("../models/user");

const HttpError = require("../models/http-error");
const mongooseUniqueValidator = require("mongoose-unique-validator");


// GET PLACE BY ID
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid; // {pid: "p1"}
  
  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("could not find a place with this id", 500);
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      "Could not find a place for the provided id ",
      404
    );
    //return error so code execution stops in case of error
    return next(error);
  }
  res.json({ place: place.toObject({ getters: true }) }); 
};

// GET PLACE BY USER ID
const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  
  let userWithPlaces = [];

  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    const error = new HttpError("Could not find places with this user id", 500);
    return next(error);
  }

  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError("Could not find a places for the provided user id", 404)
    );
  }
  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

//POST CREATE PLACE
const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passewd, please check your data", 422)
    );
  }

  //object descrcturing
  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    console.log(coordinates);
    console.log(address);
    
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path, 
    creator: req.userData.userId
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(new HttpError("Creating place failed", 500));
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 404);
    return next(error);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError("creating place failed. please try again", 500);
    return next(error);
  }

  

  res.status(201).json({ place: createdPlace });
};

// PATCH PLACE
const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422);
    throw new HttpError("Invalid inputs passewd, please check your data", 422);
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Cant find or update place", 500);
    return next(error);
  }

  if(place.creator.toString() !== req.userData.userId){
    const error = new HttpError("You are not allowed to edit this place", 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    return next(new HttpError("something weent wrong", 500));
  }
  
  res.status(200).json({ place: place.toObject({ getters: true }) });
};

// DELETE PLACE
const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;
 
  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    return next(new HttpError("Cant detele place", 500));
  }

  if (!place) {
    const error = new HttpError("Could not find place for this id", 404);
    return next(error);
  }

  //check if place is created by user who sent the request
  if(place.creator.id !== req.userData.userId){
    const error = new HttpError("You are not allowed to delete this place", 401);
    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    return next(new HttpError("cant delete place", 500));
  }
  fs.unlink(imagePath, err => {
    console.log(err);
  });

  res.status(200).json({ message: "deleted place." });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
