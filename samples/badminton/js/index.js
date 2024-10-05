let videoWidth, videoHeight;

let qvga = {width: {exact: 320}, height: {exact: 240}};

let vga = {width: {exact: 640}, height: {exact: 480}};

let resolution = window.innerWidth < 640 ? qvga : vga;

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

let lower = null;
let upper = null;
let kernel = null;
let hsv = null;
let cny = null;
let red = null;

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
  cny = new cv.Mat(video.height, video.width, cv.CV_8UC1);
  dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);

  // Define range for green color in HSV
  lower = new cv.Mat(video.height, video.width, cv.CV_8UC3, [35, 50, 50, 0]);
  upper = new cv.Mat(video.height, video.width, cv.CV_8UC3, [85, 255, 255, 255]);
  kernel = cv.Mat.ones(5, 5, cv.CV_8U);
  hsv = new cv.Mat();

  red = new cv.Mat(video.height, video.width, cv.CV_8UC4, [255, 0, 0, 255]);

  requestAnimationFrame(processVideo);
}

function processVideo() {
  stats.begin();

  cap.read(frame);

  // extract green court and dilate
  cv.cvtColor(frame, hsv, cv.COLOR_BGR2HSV);
  cv.inRange(hsv, lower, upper, mask);
  cv.dilate(mask, mask, kernel);

  // overlay detected green court over grayscaled background
  cv.cvtColor(frame, gry, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(gry, dst, cv.COLOR_GRAY2RGBA);
  frame.copyTo(dst, mask);

  // edge detect court lines only on green part
  cv.Canny(gry, cny, 50, 200, 3);
  cv.bitwise_and(cny, mask, cny);
  red.copyTo(dst, cny);

  cv.imshow('canvasOutput', dst);  // Changed from cny to dst

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
