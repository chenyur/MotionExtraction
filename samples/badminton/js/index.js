let stopped = true;

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

let canvasInput = document.getElementById('canvasInput');
let canvasInputCtx = canvasInput.getContext('2d');

let info = document.getElementById('info');

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

function loadImage() {
  const img = new Image();

  img.addEventListener("load", () => {
    canvasInputCtx.drawImage(img, -130, 0);
    startCamera();
  });

  img.src = "../images/paris.jpeg";
}

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

function startVideoProcessing() {
  if (!streaming) { console.warn("Please startup your webcam"); return; }
  stopVideoProcessing();

  canvasBuffer = document.createElement('canvas');
  canvasBuffer.width = videoWidth;
  canvasBuffer.height = videoHeight;
  canvasBufferCtx = canvasBuffer.getContext('2d');

  cap = new cv.VideoCapture(video);

  frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
  mask = new cv.Mat(video.height, video.width, cv.CV_8UC1);

  fgbg = new cv.BackgroundSubtractorMOG2(500, 16, true);

  dil = new cv.Mat(video.height, video.width, cv.CV_8UC1);
  gry = new cv.Mat(video.height, video.width, cv.CV_8UC1);
  bin = new cv.Mat(video.height, video.width, cv.CV_8UC1);
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

  if (stopped) {
    frame = cv.imread('canvasInput');
  } else {
    cap.read(frame);
  }

  dst = cv.Mat.zeros(video.height, video.width, cv.CV_8UC3);

  // extract green court and dilate
  cv.cvtColor(frame, hsv, cv.COLOR_BGR2HSV);
  cv.inRange(hsv, lower, upper, mask);

  cv.dilate(mask, dil, kernel);

  // overlay detected green court over grayscaled background
  cv.cvtColor(frame, gry, cv.COLOR_RGBA2GRAY);

  cv.threshold(gry, bin, 200, 255, cv.THRESH_BINARY);
  cv.bitwise_not(bin, bin);

  // frame.copyTo(dst, mask); // draw highlighted badminton field

  // edge detect court lines only on green part
  cv.Canny(gry, cny, 50, 200, 3);
  cv.bitwise_and(cny, dil, cny);
  cv.bitwise_and(mask, dil, bin);
  // red.copyTo(dst, mask); // draw mask
  // cny.copyTo(dst);

  // find contours
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(bin, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);


  let poly = new cv.MatVector();
  for (let i = 0; i < contours.size(); ++i) {
    let tmp = new cv.Mat();
    let cnt = contours.get(i);



    // You can try more different parameters
    cv.approxPolyDP(cnt, tmp, 5, true);
    // cv.convexHull(cnt, tmp, false, true);



    poly.push_back(tmp);
    cnt.delete(); tmp.delete();
  }


  // draw contours
  console.log(contours.size());
  for (let i = 0; i < poly.size(); ++i) {
    let color = new cv.Scalar(128 + Math.round(Math.random() * 127),
                              128 + Math.round(Math.random() * 127),
                              128 + Math.round(Math.random() * 127));
    area = cv.contourArea(contours.get(i));
    if (area > 1000) {
      cv.drawContours(dst, poly, i, color, 1, cv.LINE_8, hierarchy, 100);
    }
  }

  cv.imshow('canvasOutput', dst);  // Changed from cny to dst

  stats.end();
  if (!stopped) requestAnimationFrame(processVideo);
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
  loadImage();
  // startCamera();
}
