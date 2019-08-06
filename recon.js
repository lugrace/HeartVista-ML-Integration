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

// RthReconTensorflowOperator
// This filter accepts a single input and passes it to a TensorFlow model 
// as complex data. Once the TensorFlow model is calculated, the result 
// is interpreted as floats and either passed as the node output, forward 
// input and attach results as a defined key or emit a signal with the results. 
// What to do is selected wheter a slot is connected, if a key is defined and 
// if output is connected. 
// complex64

var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("./model-retrained.pb"), "state_ph", "Online/softmax/Softmax");
if (!tensorFlowOperator.isModelLoaded()) {
  RTHLOGGER_ERROR("Error loading tensorflow model");
}
else{
	RTHLOGGER_ERROR("GRACE - Loaded the Tensorflow model");
}

// inverse Fourier transform of the acquired data to 
// get image domain data in complex form
var ifft = new RthReconImageFFT();
ifft.setInput(sort.output());

// splits the complex image so we can use it twice
var split = new RthReconImageSplitter();
split.setInput(ifft.output());

// magnitude of the image
// var abs = new RthReconImageAbs();
// abs.setInput(split.output(-1));

// sends image to the display
var image = new RthReconImageToRthDisplayImage();
// image.setInput(abs.output());
// image.newImage.connect(rth.newImage);

// change the complex output of split to something we can 
// put in the model
var im_real = new RthReconImageReal();
im_real.setInput(split.output(-1));

var im_imag = new RthReconImageImaginary();
im_imag.setInput(split.output(-1));

var pack = new RthReconImagePack();
pack.setInput(im_real.output(), im_imag.output());

image.setInput(im_real.output());
image.newImage.connect(rth.newImage);


// makes prediction w the tf model
var predictTraj = new RthReconTensorFlow(tensorFlowOperator);
predictTraj.setInput(pack.output());
RTHLOGGER_ERROR("GRACE - we have set the input");

predictTraj.newPrediction.connect(function(traj) {
  rth.postParameter("predictedTrajectory", traj);
});
predictTraj.setEmitOutputs(["Online/softmax/Softmax"]);

// predictTraj.newPrediction.connect();
// print("" + typeof predictTraj.output());
// var image = new RthReconImageToRthDisplayImage();
// image.setInput(predictTraj.output());
// image.newImage.connect(rth.newImage);

RTHLOGGER_ERROR("GRACE - we are technically connected?");