var sequenceId = rth.sequenceId();

rth.importJS("lib:RthViewOrdering.js");
rth.importJS("lib:RthDisplayThreePlaneTools.js");
rth.importJS(rth.filePathForName("common.js"));

var displayTools = new RthDisplayThreePlaneTools();
displayTools.setGeometryParameterWidgets({
  sliceThickness : controlWidget.inputWidget_SliceThickness,
  FOV            : controlWidget.inputWidget_FOV,
});

var shots = SB.sequence['<Repeat>.repetitions'];
var startingFieldOfView = SB.sequence["<Echo-Planar Readout>.fov"];

var xPixels = SB.sequence["<Echo-Planar Readout>.res"]; // (pixels)
var yPixels = SB.sequence["<Repeat>.repetitions"]; // (pixels)
var startingThickness = SB.sequence["<Slice Select Gradient>.thickness"];

changeFOV(30);

RTHLOGGER_ERROR("GRACE - fov: " + startingFieldOfView);

rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "shots", shots));

function changeRes(res) {
	rth.addCommand(new RthUpdateChangeResolutionCommand(sequenceId, res));
}

function changeFOV(fov) {
  fov *= 10;
  if (fov < startingFieldOfView) {
    fov = startingFieldOfView;
  }
  var scale = startingFieldOfView / fov;
  rth.addCommand(new RthUpdateChangeFieldOfViewCommand(sequenceId, fov));
  rth.addCommand(new RthUpdateChangeResolutionCommand(sequenceId, spatialResolutionX()/scale, spatialResolutionY()/scale));
  // rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId, "readout", scale, scale, startingThickness / sliceThickness()));
  // fieldOfView = fov;
}

function fieldOfView() {
  return 10*controlWidget.inputWidget_FOV.value;
}

function spatialResolutionX() {
  return fieldOfView()/xPixels;
}

function spatialResolutionY() {
  return fieldOfView()/yPixels;
}

function sliceThickness() {
  return controlWidget.inputWidget_SliceThickness.value;
}


rth.updateSharedParameter = function(key, value) {
  switch (key) {
    case "predictedTrajectory":
      // changePredictedFieldOfView(value/10);
      RTHLOGGER_ERROR("GRACE - We have the prediction under value: " + value);
      break;
  }
};