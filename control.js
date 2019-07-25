// var sequenceId = rth.sequenceId();

// var shots = SB.sequence['<Repeat>.repetitions'];

// rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "shots", shots));

// rth.updateSharedParameter = function(key, value) {
//   switch (key) {
//     case "predictedTrajectory":
//       // changePredictedFieldOfView(value/10);
//       RTHLOGGER_ERROR("GRACE - We have the prediction under value: " + value);
//       break;
//   }
// };

var sequenceId = rth.sequenceId();
var fieldOfViewDesign = SB.readout["<Spiral Readout>.fov"] * 10;

function changeFieldOfView(fovcm)
{
  var fov = 10*fovcm;

  rth.addCommand(new RthUpdateChangeFieldOfViewCommand(sequenceId, fov));

  var scale = fieldOfViewDesign/fov;
  rth.addCommand(new RthUpdateFloatParameterCommand(sequenceId, "readout", "scaleGradients", "", scale));

  controlWidget.inputWidget_FOV.vaue = fov;
}

function changePredictedFieldOfView(fov)
{
  controlWidget.label_PredictedFov.text = "Predicted FOV: " + fov + " [cm]";
}

controlWidget.inputWidget_FOV.minimum = fieldOfViewDesign / 10;
controlWidget.inputWidget_FOV.maximum = 48;
controlWidget.inputWidget_FOV.valueChanged.connect(changeFieldOfView);

changeFieldOfView(32);

rth.updateSharedParameter = function(key, value) {
  switch (key) {
    case "predictedFieldOfView":
      changePredictedFieldOfView(value/10);
      break;
  }
};
