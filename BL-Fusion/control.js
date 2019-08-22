/***************************************************************************

 Grace Lu
 June - August 2019
 lu.grace35@gmail.com

 This application continuously infers the next best trajectory to
 sample using an arbitrary tensorflow ML model. The model takes in
 an input of [1, 256, 256, 1] so the output image of the scanner
 had to be formatted to this size and put into the model as complex
 data. The model then outputs the predicted trajectory, which is
 passed along to the scanner, which updates the sampling pattern.

 Unfortunately, the sampling pattern cannot be updated while the 
 current one is playing so there may be a delay of one or two 
 trajectories. The scanner will repeat the last selected trajectories
 to maintain a steady state until the next sampling pattern can
 be implemented. 

 The base of this code is from the Brain Localizer application, which is
 a default HeartVista application that incorporates tensorflow models.
 It is also advantageous because it acquires data one acquisition at a 
 time, rather than just constantly acquiring at a high rate.

***************************************************************************/

rth.importJS("lib:RthViewOrdering.js");
rth.importJS("lib:RthDisplayThreePlaneTools.js");
rth.importJS(rth.filePathForName("common.js"));

// Get the sequence ID assigned by protocol.
var sequenceId = rth.sequenceId();

// Minimum TR calculations
var scannerTR = new RthUpdateGetTRCommand(sequenceId, [], []);
rth.addCommand(scannerTR);
var minTR = scannerTR.tr();
var minTE = SB.excitation["tr"] + SB.readout["<Cartesian Readout>.readoutStart"];

var instanceName = rth.instanceName();

// Information annotation (eg for DICOM)
rth.addSeriesDescription(instanceName);
rth.addSeriesDescription("Axial " + instanceName);
rth.addSeriesDescription("Sagittal " + instanceName);
rth.addSeriesDescription("Coronal " + instanceName);
rth.informationInsert(sequenceId, "mri.SequenceName", instanceName);
rth.informationInsert(sequenceId, "mri.PreferredPlaybackSequencing", 0);

rth.informationInsert(sequenceId, "mri.ScanningSequence", "GR");
rth.informationInsert(sequenceId, "mri.SequenceVariant", "SS");
rth.informationInsert(sequenceId, "mri.ScanOptions", "");
rth.informationInsert(sequenceId, "mri.MRAcquisitionType", "2D");
rth.informationInsert(sequenceId, "mri.NumberOfAverages", 1);
rth.informationInsert(sequenceId, "mri.EchoTrainLength", 1);

var displayTools = new RthDisplayThreePlaneTools();
displayTools.setGeometryParameterWidgets({
  sliceThickness : controlWidget.inputWidget_SliceThickness,
  FOV            : controlWidget.inputWidget_FOV,
});

var startingFieldOfView = SB.readout["<Cartesian Readout>.fov"] * 10;
var xPixels = SB.readout["<Cartesian Readout>.xRes"]; // (pixels)
var yPixels = SB.readout["<Repeat>.repetitions"]; // (pixels)
var startingThickness = SB.readout["<Slice Select Gradient>.thickness"];
var startingTip = SB.readout["<Sinc RF>.tip"];

function changeFlipAngle(angle) {
  var flipCommand = RthUpdateFloatParameterCommand(sequenceId, "readout", "scaleRF", "", angle / startingTip);
  rth.addCommand(flipCommand);
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "FlipAngle", angle));
}

function changeEchoTime(te) {
  var echoDelay = (te - minTE)*1000;
  rth.addCommand(new RthUpdateIntParameterCommand(sequenceId, "echodelay", "setDelay", "", echoDelay));
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "EchoTime", te*1000));
}

function changeRepetitionTime(tr) {
  tr *= 1000; // microseconds
  rth.addCommand(new RthUpdateIntParameterCommand(sequenceId, "", "setDesiredTR", "", tr));
  rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "RepetitionTime", tr));

  controlWidget.inputWidget_TE.maximum = tr/1000 - minTE;
}

function changeFOV(fov) {
  fov *= 10;
  if (fov < startingFieldOfView) {
    fov = startingFieldOfView;
  }
  var scale = startingFieldOfView / fov;
  rth.addCommand(new RthUpdateChangeFieldOfViewCommand(sequenceId, fov));
  rth.addCommand(new RthUpdateChangeResolutionCommand(sequenceId, spatialResolutionX()/scale, spatialResolutionY()/scale));
  rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId, "readout", scale, scale, startingThickness / sliceThickness()));
}

function changeSliceThickness(thickness) {
  if (thickness < startingThickness) {
    thickness = startingThickness;
  }
  rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId, "readout", startingFieldOfView / fieldOfView(), startingFieldOfView / fieldOfView(), startingThickness / thickness));
  rth.addCommand(new RthUpdateChangeSliceThicknessCommand(sequenceId, thickness));
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

function PrescriptionDisplay() {
  function Prescription() {
    var that = this;

    this.setFromLabel = function(label) {
      that.translation = [];
      var fov = fieldOfView();
      for (var n=0; n<3; n++) {
        that.translation[n] = label[n]*fov;
      }

      that.angle = label[3];
      that.width = label[4]*fov;
      that.height = label[5]*fov;
    };
  }

  var _updatePosition = false;
  var _view;
  var _prescriptions = [];
  var _trackingBox = new RthRectangleDisplayTool(rth.imageDisplay("main"));
  for (var n=0; n<3; n++) {
    _trackingBox.addRectangle(1,1,0,0);
    _prescriptions[n] = new Prescription();
  }
  _trackingBox.setColor(View.Axial, "#f00");
  _trackingBox.setColor(View.Coronal, "blue");
  _trackingBox.setColor(View.Sagittal, "green");
  rth.addTool(_trackingBox);

  this.update = function(labels) {
    var sublabelLength = labels.length/9;
    var labelViewOffset = 3*sublabelLength*_view;
    for (var n=0; n<3; n++) {
      _prescriptions[n].setFromLabel(labels.slice(labelViewOffset+sublabelLength*n, labelViewOffset+sublabelLength*(n+1)));
      var x = _prescriptions[n].translation[0];
      var y = _prescriptions[n].translation[1];
      _trackingBox.setPosition(n, x, y);
      _trackingBox.setSize(n, _prescriptions[n].width, _prescriptions[n].height);
      _trackingBox.setAngle(n, _prescriptions[n].angle*180/Math.PI);
    }

    if (_updatePosition && _view !== undefined) {
      var newGeometry = new RthScanGeometry(rth.prescribedGeometry());
      newGeometry.translate(_prescriptions[_view].translation, false);
      rth.setGeometry(newGeometry);
    }
  };

  this.setVisible = function(index, status) {
    _trackingBox.setVisible(index, status);
  };

  this.setView = function(view) {
    _view = view;
  };

  this.setLocalize = function(status) {
    _updatePosition = status;
  };
}
var prescriptionDisplay = new PrescriptionDisplay();

rth.updateSharedParameter = function(key, value) {
  switch (key) {
    case "shims":
      rth.addCommand(new RthUpdateShimsCommand(sequenceId, value[0], value[1], value[2], value[3]));
      break;
    case "predicted_labels":
      // The output of the tensorflow model gets passed to here
      // where it influences the sampling pattern of the scanner

      // the tf model output (256x51)
      // we want the index of the row with the highest sum
      var arr = Object.keys(value[0]).map(function(key){return value[0][key];});
      var onehot = [] // has the sums of each row for a total of 256 sums
      while(arr.length) {
        var temp = arr.splice(0, 51);
        var sum = 0;
        for(var i = 0; i < temp.length; i++) {
          sum += temp[i];
        }
        onehot.push(sum);
      }

      // finds the index of the max sum in onehot for next trajectory
      var traj = 0;
      for(var i = 0; i < onehot.length; i++) {
        if(onehot[i] > onehot[traj]) {
          traj = i
        }
      }
      
      // creates a new sampling pattern
      viewArray = []
      viewArray.push(traj)
      RTHLOGGER_ERROR("GRACE - traj: " + traj);
      RTHLOGGER_ERROR("GRACE - viewArray: " + viewArray);
      rth.addCommand(new RthUpdateAcquireViewsCommand(sequenceId, "readout", viewArray));
      break;
    case "view":
      prescriptionDisplay.setView(value);
      break;
  }
};



function sendImagingParamsToRecon(){
  rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "xPixels", xPixels));
  rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "yPixels", yPixels));
  rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "undersampledAcquisitions", sampling.numUndersampledAcquisitions()));
  rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "reconType", sampling.samplingType));
  rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "droppedArray", sampling.droppedArray()));
  rth.addCommand(new RthUpdateChangeReconstructionParameterCommand(sequenceId, "calibSize", sampling.calibrationSize));
}


rth.enableScan = function(state) {
  if (state) {
    sendImagingParamsToRecon();
  }

  var enableCommand = new RthUpdateEnableSequenceCommand(sequenceId, state);
  rth.addCommand(enableCommand);
};

rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "FrameTime", yPixels * minTR));
rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "RepetitionTime", minTR));
rth.addCommand(new RthUpdateFloatParameterCommand(sequenceId, "readout", "setRxAttenuation", "", 1));
rth.addCommand(new RthUpdateChangeMRIParameterCommand(sequenceId, "SpacingBetweenSlices", 0));



function Sampling() {
  var that = this;
  this.calibrationSize = 40; //used for spirit calibration; also defines homodyne symmetric region
  var _undersampleFactor = 2;  //for parallel imaging
  var _viewArray = [];

  this.setSampling = function(type) {
    that.samplingType = type;
    switch (type) {
      case ReconType.FFT:
        _viewArray = RthViewOrdering.linear(yPixels);
        break;
      case ReconType.Homodyne:
        _viewArray = RthViewOrdering.uniformUndersampleWithCalRegion(yPixels, that.calibrationSize, 1, true);
        break;
      case ReconType.Spirit:
        _viewArray = RthViewOrdering.uniformUndersampleWithCalRegion(yPixels, that.calibrationSize, _undersampleFactor, false);
        break;
      case ReconType.SpiritHomodyne:
        _viewArray = RthViewOrdering.uniformUndersampleWithCalRegion(yPixels, that.calibrationSize, _undersampleFactor, true);
        break;
      default:
        RTHLOGGER_WARNING("Invalid sampling type " + type);
    }
    RTHLOGGER_DEBUG("Phase encodes " + _viewArray.length);
  };

  this.droppedArray = function() {
    var droppedArray = [];
    for (var i = 0; i < yPixels; i++) {
      if (_viewArray.indexOf(i) == -1) {
        droppedArray.push(i);
      }
    }

    // we're only sending spirit the dropped views from acquired half of kspace
    if (that.samplingType==ReconType.Homodyne || that.samplingType==ReconType.SpiritHomodyne) {
      var droppedArrayPartial = [];
      for(var m = 0; m<droppedArray.length; m++){
        if(droppedArray[m] > yPixels/2) {
          droppedArrayPartial.push(droppedArray[m]);
        }
      }
      return droppedArrayPartial;
    } else {
      return droppedArray;
    }
  };

  this.numUndersampledAcquisitions = function() {
    return _viewArray.length;
  };
}

var sampling = new Sampling();

controlWidget.reconGroupBox.radioButton_fullySampled.toggled.connect(function(state) {
  if (state) {
    sampling.setSampling(ReconType.FFT);
  }
});

controlWidget.reconGroupBox.radioButton_partial.toggled.connect(function(state) {
  if (state) {
    sampling.setSampling(ReconType.Homodyne);
  }
});

controlWidget.reconGroupBox.radioButton_parallel.toggled.connect(function(state) {
  if (state) {
    sampling.setSampling(ReconType.Spirit);
  }
});

controlWidget.reconGroupBox.radioButton_partialParallel.toggled.connect(function(state) {
  if (state) {
    sampling.setSampling(ReconType.SpiritHomodyne);
  }
});

controlWidget.inputWidget_FlipAngle.valueChanged.connect(changeFlipAngle);
controlWidget.inputWidget_FOV.valueChanged.connect(changeFOV);
controlWidget.inputWidget_SliceThickness.valueChanged.connect(changeSliceThickness);
controlWidget.inputWidget_TE.valueChanged.connect(changeEchoTime);
controlWidget.inputWidget_TR.valueChanged.connect(changeRepetitionTime);

controlWidget.reconGroupBox.radioButton_fullySampled.checked = true;
controlWidget.reconGroupBox.radioButton_parallel.visible = false;
controlWidget.reconGroupBox.radioButton_partialParallel.visible = false;

controlWidget.groupBox_View.checkBox_Axial.toggled.connect(function(status) {
  prescriptionDisplay.setVisible(View.Axial, status);
});
controlWidget.groupBox_View.checkBox_Coronal.toggled.connect(function(status) {
  prescriptionDisplay.setVisible(View.Coronal, status);
});
controlWidget.groupBox_View.checkBox_Sagittal.toggled.connect(function(status) {
  prescriptionDisplay.setVisible(View.Sagittal, status);
});

controlWidget.checkBox_Translate.toggled.connect(prescriptionDisplay.setLocalize);

rth.setRecordMode('EnableRecord');
controlWidget.inputWidget_FOV.minimum = startingFieldOfView / 10;
controlWidget.inputWidget_FOV.maximum = 48;
controlWidget.inputWidget_FOV.value = Math.max(32, startingFieldOfView / 10);
changeFOV(controlWidget.inputWidget_FOV.value);

controlWidget.inputWidget_FlipAngle.minimum = 0;
controlWidget.inputWidget_FlipAngle.maximum = SB.readout["<Sinc RF>.tip"];
controlWidget.inputWidget_FlipAngle.value = Math.min(60, SB.readout["<Sinc RF>.tip"]);
changeFlipAngle(controlWidget.inputWidget_FlipAngle.value);

controlWidget.inputWidget_SliceThickness.minimum = startingThickness;
controlWidget.inputWidget_SliceThickness.maximum = startingThickness * 4;
controlWidget.inputWidget_SliceThickness.value = startingThickness;
changeSliceThickness(controlWidget.inputWidget_SliceThickness.value);

controlWidget.inputWidget_TE.minimum = Math.ceil(minTE);
controlWidget.inputWidget_TR.minimum = Math.ceil(minTR);
controlWidget.inputWidget_TR.maximum = 500;

controlWidget.groupBox_View.checkBox_Axial.checked = true;
controlWidget.groupBox_View.checkBox_Coronal.checked = true;
controlWidget.groupBox_View.checkBox_Sagittal.checked = true;

controlWidget.checkBox_Translate.checked = false;
