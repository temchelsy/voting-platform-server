import mongoose from "mongoose";

const contestantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  photoUrl: {
    type: String,
    required: true
  },
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true
  },
  votes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

contestantSchema.methods.getVoteCount = async function() {
  return this.votes;
};

const Contestant = mongoose.model("Contestant", contestantSchema);
export default Contestant;
