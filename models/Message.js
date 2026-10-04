const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    type: {
      type: String,
      enum: ["text", "file"],
      default: "text"
    },

    fileUrl: {
      type: String,
      default: null
    },

    fileName: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Message", messageSchema);