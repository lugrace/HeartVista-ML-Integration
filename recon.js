var sequenceId = rth.sequenceId();

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

 RTHLOGGER_ERROR("GRACE - samples " + samples);
 RTHLOGGER_ERROR("GRACE - shots " + shots);
 RTHLOGGER_ERROR("GRACE - totalReadouts " + totalReadouts);

 // addBatchDimension.outputExtent = [samples, totalReadouts, 1];

  sort.setExtent([samples,totalReadouts]);
  // sort.setExtent([128,128]);
});
sort.setInput(observer.output());

// var data = new RthReconData();

// function changeFOV(fov) {
// 	rth.addCommand(new RthUpdateChangeResolutionCommand(sequenceId, fov, fov));
// }

// function changeFOV(fov) {
//   fov *= 10;
//   if (fov < startingFieldOfView) {
//     fov = startingFieldOfView;
//   }
//   var scale = startingFieldOfView / fov;
//   rth.addCommand(new RthUpdateChangeFieldOfViewCommand(sequenceId, fov));
//   rth.addCommand(new RthUpdateChangeResolutionCommand(sequenceId, spatialResolutionX()/scale, spatialResolutionY()/scale));
//   rth.addCommand(new RthUpdateScaleGradientsCommand(sequenceId, "readout", scale, scale, startingThickness / sliceThickness()));
//   // fieldOfView = fov;
// }

// changeFOV(50)

// var startingFieldOfView = SB.readout["<Cartesian Readout>.fov"]
//  RTHLOGGER_ERROR("GRACE - startingFieldOfView " + startingFieldOfView);

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

var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("./model-retrained-v2.pb"), "state_ph", "Online/softmax/Softmax");
// var tensorFlowOperator = new RthReconTensorFlowOperator(rth.filePathForName("brain_planes.pb"), "input_images", "predicted_labels");

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

// var scale = new RthReconImageScale();
// scale.setInput(ifft.output());
// scale.setScaling(2.0);

// var reshape = new RthReconImageReshape();
// reshape.setInput(ifft.output());
// reshape.outputExtent = [256, 256, 1];

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

var pack2 = new RthReconImagePack();
pack2.setInput(pack.output(), 1);

// var pack3 = new RthReconImagePack();
// pack3.setInput(pack2.output(), 1);

// var transpose = new RthReconImagePermute();
// transpose.setOrder([1, 2, 3, 0]);
// transpose.setInput(pack2.output());

// var imageExport = new RthReconImageExport();
// var exportFileName = "test.dat";
// imageExport.setFileName(exportFileName);
// imageExport.setInput(transpose.output())

var addBatchDimension = new RthReconImageReshape();
addBatchDimension.setInput(pack.output());
addBatchDimension.outputExtent = [1, 256, 256, 1]

image.setInput(im_real.output());
image.newImage.connect(rth.newImage);

// // makes prediction w the tf model
var predictTraj = new RthReconTensorFlow(tensorFlowOperator);
predictTraj.setInput(addBatchDimension.output());
RTHLOGGER_ERROR("GRACE - we have set the input");

predictTraj.newPrediction.connect(function(information, labels) {
  rth.postParameter("predictedTrajectory", labels);
});
predictTraj.setEmitOutputs(["Online/softmax/Softmax"]);

// var tensorflow = new RthReconTensorFlow(tensorFlowOperator);
// tensorflow.newPrediction.connect(function(information, labels) {
//   rth.postParameter("predicted_labels", labels[0]);
// });
// tensorflow.setEmitOutputs(["predicted_labels"]);
// tensorflow.setInput(addBatchDimension.output());

RTHLOGGER_ERROR("GRACE - we are technically connected?");