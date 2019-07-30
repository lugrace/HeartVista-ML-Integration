var sequenceId = rth.sequenceId();

// var reconType = ReconType.FFT;

var observer = new RthReconRawObserver();
observer.setSequenceId(sequenceId);

// sorts data onto grid in kspace
var sort = new RthReconSort();
sort.setIndexKeys(['acquisition.index']);
sort.observeMultipleKeys([
 "reconstruction.shots",
 "acquisition.samples"
]);
sort.observedKeysChanged.connect(function(keys) {
 var samples = keys["acquisition.samples"];
 var shots = keys["reconstruction.shots"];
 var echoTrainLength = Math.ceil(samples*1.0/shots);
 var totalReadouts = echoTrainLength*shots;

  sort.setExtent([samples,totalReadouts]);
});
sort.setInput(observer.output());

// tensorflow operator(filepath, input node name, output node name)
// output is sampling_probabilities
// model-v2 only contains Online/softmax/Softmax
RTHLOGGER_ERROR("GRACE - loading Tensorflow Model");
// var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("./model-v2.pb"), "state_ph", "sampling_probabilities");
var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("./model-v2.pb"), "state_ph", "Online/softmax/Softmax");
if (!tensorFlowOperator.isModelLoaded()) {
  RTHLOGGER_ERROR("Error loading tensorflow model");
}
else{
	RTHLOGGER_ERROR("GRACE - Loaded the Tensorflow model");
}

// inverse Fourier transform of the acquired data to 
// get image domain data
var ifft = new RthReconImageFFT();
ifft.setInput(sort.output());

// magnitude of the image
var abs = new RthReconImageAbs();
abs.setInput(ifft.output());

// sends image to the display
// var image = new RthReconImageToRthDisplayImage();
// image.setInput(abs.output());
// image.newImage.connect(rth.newImage);

// makes prediction w the tf model
var predictTraj = new RthReconTensorFlow(tensorFlowOperator);
predictTraj.setInput(abs.output());
RTHLOGGER_ERROR("GRACE - we have set the input");

// predictTraj.setConnectedOutputs(["Online/softmax/Softmax"]);

predictTraj.newPrediction.connect(function(traj) {
  rth.postParameter("predictedTrajectory", traj);
});
// predictTraj.newPrediction.connect();
print("" + typeof "test");
// print("" + typeof predictTraj.output());
// var image = new RthReconImageToRthDisplayImage();
// image.setInput(predictTraj.output());
// image.newImage.connect(rth.newImage);

RTHLOGGER_ERROR("GRACE - we are technically connected?");

// var predictFov = new RthReconTensorFlow(tensorFlowOperator);
// predictFov.setInput(addBatchDimension.output());
// predictFov.newPrediction.connect(function(fov) {
//   rth.postParameter("predictedFieldOfView", fov);
// });

// var sequenceId = rth.sequenceId();

// var kspace = new RthReconKSpace();
// if (!kspace.loadFromReadoutTags(rth.readoutTags("readout"))) {
//   RTHLOGGER_ERROR("Could not load k-space trajectory from readout tags");
// }

// var griddingOperator = new RthReconGriddingOperator2D(kspace);
// var deapodizationWindow = new RthReconImageSplitter();
// deapodizationWindow.setInput(griddingOperator.deapodizationWindow());

// var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("./model-v2.pb"), "state_ph", 'predicted_fov');
// if (!tensorFlowOperator.isModelLoaded()) {
//   RTHLOGGER_ERROR("Error loading tensorflow model");
// }

// var observer = new RthReconRawObserver();
// observer.setSequenceId(sequenceId);

// var grid = new RthReconRawToImageGrid(griddingOperator);
// grid.setInput(observer.output());

// var ifft = new RthReconImageFFT();
// ifft.setInput(grid.output());

// var crop = new RthReconImageCrop();
// crop.setXSize(griddingOperator.imageSize[0]);
// crop.setYSize(griddingOperator.imageSize[1]);
// crop.setUpdateGeometry(false);
// crop.setInput(ifft.output());

// var deapodize = new RthReconImageMultiply();
// deapodize.setInput(0, crop.output());
// deapodize.setInput(1, deapodizationWindow.output(-1));
// deapodize.setPersistentInput(1);
// deapodize.informationPort = 0;

// var magnitude = new RthReconImageAbs();
// magnitude.setInput(deapodize.output());

// var splitImage = new RthReconImageSplitter();
// splitImage.setInput(0, magnitude.output());

// // display
// var image = new RthReconImageToRthDisplayImage();
// image.setInput(splitImage.output(-1));
// image.newImage.connect(rth.newImage);

// // prediction
// var addBatchDimension = new RthReconImageReshape();
// var expandedSize = griddingOperator.imageSize;
// expandedSize.push(1);
// addBatchDimension.outputExtent = expandedSize;
// addBatchDimension.setInput(splitImage.output(-1));

// var predictFov = new RthReconTensorFlow(tensorFlowOperator);
// predictFov.setInput(addBatchDimension.output());
// predictFov.newPrediction.connect(function(fov) {
//   rth.postParameter("predictedFieldOfView", fov);
// });
