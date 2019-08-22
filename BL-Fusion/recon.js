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

rth.importJS("lib:RthReconSPIRiT.js");
rth.importJS("lib:RthReconHomodyne.js");
rth.importJS("lib:RthImageThreePlaneOutput.js");
rth.importJS(rth.filePathForName("common.js"));

var sequenceId = rth.sequenceId();

var reconType = ReconType.FFT;

var scanNotification = rth.scanNotification();
var reconProgress = scanNotification.addProgressBar("Reconstructing");


var observer = new RthReconRawObserver();
observer.objectName = "Observer";
observer.setSequenceId(sequenceId);
observer.setPackCoils(false);
observer.observeValueForKey("acquisition.samples", "samples");
observer.observeKeys(["reconstruction.droppedArray",
                      "reconstruction.xPixels",
                      "reconstruction.yPixels",
                      "reconstruction.calibSize",
                      "reconstruction.reconType"]);
observer.observedKeysChanged.connect(
  function(keys) {
    var droppedArray = keys["reconstruction.droppedArray"];
    var xPixels =  keys["reconstruction.xPixels"];
    var yPixels =  keys["reconstruction.yPixels"];
    var calibSize =  keys["reconstruction.calibSize"];
    var reconType = keys["reconstruction.reconType"];

    reconMultiCoil.setReconType(reconType);

    reconMultiCoil.setCalibrationSize(calibSize);
    reconMultiCoil.setSize([xPixels, yPixels]);
    reconMultiCoil.setUnacquiredViews(droppedArray);
  }
);
observer.scanEnabled.connect(function() {
  reconProgress.progress = 0.0;
});
observer.scanDisabled.connect(function(completed) {
  if(completed) {
    reconProgress.progress = 1.0;
    rth.deactivateScanButton();
  }
});


function reconBlockSort(index) {
  var _sort = new RthReconSort();
  _sort.setObjectName("sort " + index + " ");
  _sort.setIndexKeys(["acquisition.index"]);
  _sort.observeKeys(["reconstruction.xPixels",
                     "reconstruction.yPixels",
                     "reconstruction.undersampledAcquisitions",
                     "series.SeriesInstanceUID"]);
  _sort.observedKeysChanged.connect(function(keys) {
    var xPixels =  keys["reconstruction.xPixels"];
    var yPixels =  keys["reconstruction.yPixels"];
    var undersampledAcquisitions =  keys["reconstruction.undersampledAcquisitions"];
    // _sort.setExtent([xPixels, yPixels]);
    _sort.setExtent([256, 256]);
    _sort.setAccumulate(undersampledAcquisitions);
    _sort.setAccumulationThreshold(undersampledAcquisitions);
    _sort.resetAccumulation();
  });

  this.setInput = function(input) {
    _sort.setInput(input);
  };

  this.output = function() {
    return _sort.output();
  };
}


function ReconIFFT(index) {
  var _ifft = new RthReconImageFFT();
  _ifft.objectName = "iFFT " + index;
  _ifft.setForward(false);

  this.setInput = function(input) {
    _ifft.setInput(input);
  };

  this.output = function() {
    return _ifft.output();
  };
}


function ReconMultiCoil() {
  // RTH-2821 fix SPIRiT recon
  var that = this;

  var _coilRecons = [];
  var _inputs = [];
  var _sortedInputs = [];
  var _reconType = ReconType.FFT;

  var _spirit = new RthReconSPIRiT(true);
  _spirit.setKernelSize([7,7]);
  _spirit.setKernelLambda(0.2);
  _spirit.setLambda(0.5);
  _spirit.setIterations(10);
  _spirit.setTolerance(0);
  _spirit.connectIterationProgress(reconProgress.setProgress);

  this.setCalibrationSize = function(calibrationSize) {
    _spirit.setCalibSize([calibrationSize, calibrationSize]);
  };

  this.setSize = function(sizeX, sizeY) {
    _spirit.setSize([sizeX, sizeY]);
  };

  this.setUnacquiredViews = _spirit.setUnacquiredViews;

  var _sos = new RthReconImageSumOfSquares();

  var unwarp = new RthReconImageGradWarp();
  unwarp.setKernelRadius(2);
  unwarp.setInput(_sos.output());

  var _abs = new RthReconImageAbs();
  _abs.setInput(unwarp.output());

  this.clear = function() {
    _coilRecons = [];
  };

  this.setInput = function(index, input) {
    if (_reconType === undefined) {
      RTHLOGGER_WARNING("Recon type not set");
      return;
    }

    _inputs[index] = input;
    _sortedInputs[index] = new reconBlockSort(index);
    _sortedInputs[index].setInput(input);

    var sizeKeys = ["reconstruction.xPixels", "reconstruction.yPixels"];
    var calibrationSizeKey = "reconstruction.calibSize";

    var sortedInput = _sortedInputs[index].output();
    switch (_reconType) {
      case ReconType.FFT:
      case ReconType.Homodyne:
        var ifft = new ReconIFFT(index);
        ifft.setInput(sortedInput);
        if (_reconType == ReconType.FFT) {
          _coilRecons[index] = ifft;
        } else {
          _coilRecons[index] = new reconHomodyneBlock(ifft.output(), sizeKeys, calibrationSizeKey, index);
        }
        break;
      case ReconType.Spirit:
      case ReconType.SpiritHomodyne:
        _spirit.setInput(index, sortedInput);

        if (reconType==ReconType.SpiritHomodyne) {
          _coilRecons[index] = new reconHomodyneBlock(_spirit.output(index), sizeKeys, calibrationSizeKey, index);
        }
        break;
      default:
        RTHLOGGER_WARNING("Unsupported recon type " + _reconType);
    }

    if (_reconType==ReconType.Spirit) {
      _sos.setInput(index, _spirit.output(index));
    } else {
      _sos.setInput(index, _coilRecons[index].output());
    }
  };

  this.output = function() {
    return _abs.output();
  };

  this.setReconType = function(reconType) {
    _reconType = reconType;

    for (var c=0; c<_coilRecons.length; c++) {
      if (_coilRecons[c].reconType != reconType) {
        that.setInput(c, _inputs[c]);
      }
    }
  };

  this.clear();
}

var reconMultiCoil = new ReconMultiCoil();

var split = new RthReconSplitter();
split.observeKeys(["reconstruction.xPixels", "reconstruction.yPixels"]);
split.observedKeysChanged.connect(function(keys) {
  var xPixels =  keys["reconstruction.xPixels"];
  var yPixels =  keys["reconstruction.yPixels"];

  // formats the dimensions of image to match model (1, 256, 256, 1)
  addBatchDimension.outputExtent = [1, xPixels, yPixels, 1];
  RTHLOGGER_ERROR("GRACE - Pixels " + xPixels + " x " + yPixels);
});
split.setInput(reconMultiCoil.output());

var imageDisplay = new RthImageThreePlaneOutput();
imageDisplay.setInput(split.output(-1));

var addBatchDimension = new RthReconImageReshape();
addBatchDimension.setInput(split.output(-1));

var ifft = new RthReconImageFFT();
ifft.setInput(addBatchDimension.output());

RTHLOGGER_ERROR("GRACE - loading Tensorflow Model");

// state_ph is the input tensor and Online/softmax/Softmax
// is the output tensor
var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("./model-retrained-v2.pb"), "state_ph", "Online/softmax/Softmax");

if (!tensorFlowOperator.isModelLoaded()) {
  RTHLOGGER_ERROR("Error loading tensorflow model");
}
else{
  RTHLOGGER_ERROR("GRACE - Loaded the Tensorflow model");
}

// tensorflow block
var tensorflow = new RthReconTensorFlow(tensorFlowOperator);
tensorflow.newPrediction.connect(function(information, labels) {
  rth.postParameter("predicted_labels", labels);
});
tensorflow.setEmitOutputs(["Online/softmax/Softmax"]);
tensorflow.setInput(addBatchDimension.output());

function connectCoils(coils) {
  reconMultiCoil.clear();
  for (var i = 0; i < coils ; i++) {
    reconMultiCoil.setInput(i, observer.output(i));
  }
  rth.collectGarbage();
}
observer.coilsChanged.connect(connectCoils);

function sendView(view) {
  rth.postParameter("view", view);
}
