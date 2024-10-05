let videoWidth, videoHeight;

let qvga = {width: {exact: 320}, height: {exact: 240}};

let vga = {width: {exact: 640}, height: {exact: 480}};

let fhd = {width: {ideal: 1920}, height: {ideal: 1080}};

let resolution = fhd;

//let resolution = window.innerWidth < 640 ? qvga : vga;

// whether streaming video from the camera.
let streaming = false;

let video = document.getElementById('video');
let canvasOutput = document.getElementById('canvasOutput');
let canvasOutputCtx = canvasOutput.getContext('2d');
let stream = null;

let info = document.getElementById('info');

function startCamera() {
  if (streaming) return;
  navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      return navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: videoDevices[videoDevices.length - 1].deviceId },
          ...resolution
        },
        audio: false
      });
    })
    .then(function(s) {
      stream = s;
      video.srcObject = s;
      video.play();
    })
    .catch(function(err) {
      console.log("An error occurred! " + err);
    });

  video.addEventListener("canplay", function(ev){
    if (!streaming) {
      videoWidth = video.videoWidth;
      videoHeight = video.videoHeight;
      video.setAttribute("width", videoWidth);
      video.setAttribute("height", videoHeight);
      canvasOutput.width = videoWidth;
      canvasOutput.height = videoHeight;
      streaming = true;
    }
    startVideoProcessing();
  }, false);
}

let canvasInput = null;
let canvasInputCtx = null;

let canvasBuffer = null;
let canvasBufferCtx = null;

let src = null;
let gry = null;
let dst = null;

let cap = null;

let frame = null;
let mask = null;
let fgbg = null;

function startVideoProcessing() {
  if (!streaming) { console.warn("Please startup your webcam"); return; }
  stopVideoProcessing();
  canvasInput = document.createElement('canvas');
  canvasInput.width = videoWidth;
  canvasInput.height = videoHeight;
  canvasInputCtx = canvasInput.getContext('2d');

  canvasBuffer = document.createElement('canvas');
  canvasBuffer.width = videoWidth;
  canvasBuffer.height = videoHeight;
  canvasBufferCtx = canvasBuffer.getContext('2d');

  cap = new cv.VideoCapture(video);

  frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
  mask = new cv.Mat(video.height, video.width, cv.CV_8UC1);

  fgbg = new cv.BackgroundSubtractorMOG2(500, 16, true);

  gry = new cv.Mat(video.height, video.width, cv.CV_8UC1);
  dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);

  requestAnimationFrame(processVideo);
}

function processVideo() {
  stats.begin();

  cap.read(frame);

  // Create a new Mat to store the HSV image
  let hsv = new cv.Mat();
  // Convert frame from BGR to HSV color space
  cv.cvtColor(frame, hsv, cv.COLOR_BGR2HSV);

  // Define range for green color in HSV
  let lower = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 50, 50, 0]);
  let upper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 255]);

  // Create mask for green color
  cv.inRange(hsv, lower, upper, mask);

  // Optional: Apply morphological operations to remove noise
  let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
  cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

  // Convert frame to grayscale
  cv.cvtColor(frame, gry, cv.COLOR_RGBA2GRAY);
  
  // Make the grayscale image darker
  cv.convertScaleAbs(gry, gry, 0.5, 0);
  
  // Convert grayscale to RGBA
  cv.cvtColor(gry, dst, cv.COLOR_GRAY2RGBA);

  // Copy the original frame to dst only where the mask is non-zero
  frame.copyTo(dst, mask);
  
  cv.imshow('canvasOutput', dst);

  // Clean up
  hsv.delete();
  lower.delete();
  upper.delete();
  kernel.delete();

  stats.end();
  requestAnimationFrame(processVideo);
}

function stopVideoProcessing() {
  // if (src != null && !src.isDeleted()) src.delete();
}

function stopCamera() {
  if (!streaming) return;
  stopVideoProcessing();
  document.getElementById("canvasOutput").getContext("2d").clearRect(0, 0, width, height);
  video.pause();
  video.srcObject=null;
  stream.getVideoTracks()[0].stop();
  streaming = false;
}

function initUI() {
  stats = new Stats();
  stats.showPanel(0);
  document.getElementById('container').appendChild(stats.dom);
}

function opencvIsReady() {
  console.log('OpenCV.js is ready');
  if (!featuresReady) {
    console.log('Requred features are not ready.');
    return;
  }
  info.innerHTML = '';
  initUI();
  startCamera();
}
