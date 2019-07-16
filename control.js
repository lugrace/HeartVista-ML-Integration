var sequenceId = rth.sequenceId();

var shots = SB.sequence['<Repeat>.repetitions'];

rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "shots", shots));
