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

  sort.setExtent([samples,totalReadouts]);
});
sort.setInput(observer.output());

// inverse Fourier transform of the acquired data to 
// get image domain data
var ifft = new RthReconImageFFT();
ifft.setInput(sort.output());

// magnitude of the image
var abs = new RthReconImageAbs();
abs.setInput(ifft.output());

// sends image to the display
var image = new RthReconImageToRthDisplayImage();
image.setInput(abs.output());
image.newImage.connect(rth.newImage);
