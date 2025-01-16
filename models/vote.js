import mongoose from "mongoose";

const voteSchema = new mongoose.Schema({
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true
  },
  contestantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contestant',
    required: true
  },
  voterId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

voteSchema.index({ contestId: 1, contestantId: 1, voterId: 1 }, { unique: true });

const Vote = mongoose.model('Vote', voteSchema);
export default Vote