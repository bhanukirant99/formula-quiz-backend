const express = require("express");
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const { User } = require('../model/user.model');
const { catchError } = require('../utils');
const bcrypt = require("bcrypt");

const router = express.Router();
const secret = process.env.secret;

router.route("/sign-up")
  .post(async (req, res, next) => {
    catchError(next, async () => {
      let { user } = req.body;
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
      let newUser = new User(user);
      newUser = await newUser.save();
      const token = jwt.sign({ _id: newUser._id }, secret, { expiresIn: "24h" });
      let userData = _.pick(newUser, ["_id", "name", "email", "takenQuizList"])
      userData = _.extend(userData, { token });
      res.json({
        success: true,
        user: userData
      });
    });
  });

router.route("/login")
  .post(async (req, res, next) => {
    catchError(next, async () => {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (user) {
        const validPassword = await bcrypt.compare(password, user.password)
        if (validPassword) {
          const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "24h" });
          let userData = _.pick(user, ["_id", "name", "email", "takenQuizList"])
          userData = _.extend(userData, { token });
          return res.json({
            success: true,
            user: userData
          });
        }
        return res.status(401).json({
          success: false,
          message: "Authentication error!"
        });
      }
      return res.json({
        success: false,
        message: "User not found!"
      });
    });
  });

const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization;
  try {
    const decoded = jwt.verify(token, secret);
    req.userId = decoded._id;
    return next();
  }
  catch (err) {
    console.log({ err });
    return res.status(401).json({
      success: false,
      message: "Authentication error!"
    })
  }
}

router.route("/")
  .post(authenticateUser, async (req, res, next) => {
    catchError(next, async () => {
      let user = await User.findById(req.userId);
      const { takenQuiz } = req.body;
      user = _.extend(user, { takenQuizList: _.concat(user.takenQuizList, takenQuiz) });
      user = await user.save();
      res.json({
        success: true,
      });
    });
  })
  .get(authenticateUser, async (req, res, next) => {
    catchError(next, async () => {
      const user = await User.findById(req.userId);
      if (user) {
        return res.json({
          success: true,
          user: _.pick(user, ["_id", "name", "email", "takenQuizList"])
        });
      }
      return res.json({
        success: false,
        message: "User not found!"
      });
    });
  });

router.route("/quiz/:id")
  .delete(authenticateUser, async (req, res, next) => {
    catchError(next, async () => {
      let user = await User.findById(req.userId);
      const { id } = req.params;
      user = _.extend(user, { takenQuizList: _.filter(user.takenQuizList, (quiz) => quiz.quizId.toString() !== id) });

      const updatedTakenQuizList = _.pick(user, ["takenQuizList"]);

      user = await user.save();
      res.json({
        success: true,
        takenQuizList: updatedTakenQuizList.takenQuizList
      });
    });
  })

module.exports = router;
