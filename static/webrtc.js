var mystream;
var pc1;
var pc2;
var bytesPrev = 0;
var timestampPrev = 0;

$ = function(id) {
  return document.getElementById(id);
}

function log(txt) {
  console.log(txt);
}

function openCamera() {
  if (mystream) {
    mystream.stop();
  }
  navigator.getUserMedia(cameraConstraints(), gotStream, function() {
     log("GetUserMedia failed");
  });
}

function gotStream(stream) {
  log("GetUserMedia succeeded");
  mystream = stream;
  attachMediaStream($("local-video"), stream);
}

function cameraConstraints() {
  var constraints = {};
  constraints.audio = true;
  constraints.video = { mandatory: {}, optional: [] };
  if ($("minwidth").value != "0") {
    constraints.video.mandatory.minWidth = $("minwidth").value;
  }
  if ($("maxwidth").value != "0") {
    constraints.video.mandatory.maxWidth = $("maxwidth").value;
  }
  if ($("minheight").value != "0") {
    constraints.video.mandatory.minHeight = $("minheight").value;
  }
  if ($("maxheight").value != "0") {
    constraints.video.mandatory.maxHeight = $("maxheight").value;
  }
  if ($("frameRate").value != "0") {
    constraints.video.mandatory.minFrameRate = $("frameRate").value;
  }
  log('Camera constraints are ' + JSON.stringify(constraints));
  $("cameraConstraints").innerHTML = JSON.stringify(constraints, null, ' ');
  return constraints;
}

function streamConstraints() {
  var constraints = { mandatory: {}, optional: [] };
  if ($("bandwidth").value != "0") {
    constraints.optional[0] = { 'bandwidth' : $('bandwidth').value };
  }
  log('Constraints are ' + JSON.stringify(constraints));
  $("addStreamConstraints").innerHTML = JSON.stringify(constraints, null, ' ');
  return constraints;
}

function connect() {
  pc1 = new RTCPeerConnection(null);
  pc2 = new RTCPeerConnection(null);
  pc1.addStream(mystream, streamConstraints());
  log('PC1 creating offer');
  pc1.onnegotiationeeded = function() {
    log('Negotiation needed - PC1');
  }
  pc2.onnegotiationeeded = function() {
    log('Negotiation needed - PC2');
  }
  pc1.onicecandidate = function(e) {
    log('Candidate PC1');
    if (e.candidate) {
      pc2.addIceCandidate(new RTCIceCandidate(e.candidate),
                          onAddIceCandidateSuccess, onAddIceCandidateError);
    }
  }
  pc2.onicecandidate = function(e) {
    log('Candidate PC2');
    if (e.candidate) {
      pc1.addIceCandidate(new RTCIceCandidate(e.candidate),
                          onAddIceCandidateSuccess, onAddIceCandidateError);
    }
  }
  pc2.onaddstream = function(e) {
    log('PC2 got stream');
    attachMediaStream($('remote-video'), e.stream);
    log('Remote video is ' + $('remote-video').src);
  }
  pc1.createOffer(function(desc) {
    log('PC1 offering');
    pc1.setLocalDescription(desc);
    pc2.setRemoteDescription(desc);
    pc2.createAnswer(function(desc2) {
      log('PC2 answering');
      pc2.setLocalDescription(desc2);
      pc1.setRemoteDescription(desc2);
    });
  });
}

function onAddIceCandidateSuccess() {
  trace("AddIceCandidate success.");
}

function onAddIceCandidateError(error) {
  trace("Failed to add Ice Candidate: " + error.toString());
}

// Augumentation of stats entries with utility functions.
// The augumented entry does what the stats entry does, but adds
// utility functions.
function AugumentedStatsResponse(response) {
  this.response = response;
  this.addressPairMap = [];
}

AugumentedStatsResponse.prototype.collectAddressPairs = function(componentId) {
  if (!this.addressPairMap[componentId]) {
    this.addressPairMap[componentId] = [];
    for (var i = 0; i < this.response.result().length; ++i) {
      var res = this.response.result()[i];
      if (res.type == 'googCandidatePair' &&
          res.stat('googChannelId') == componentId) {
        this.addressPairMap[componentId].push(res);
      }
    }
  }
  return this.addressPairMap[componentId];
}

AugumentedStatsResponse.prototype.result = function() {
  return this.response.result();
}

// The indexed getter isn't easy to prototype.
AugumentedStatsResponse.prototype.get = function(key) {
  return this.response[key];
}


// Display statistics
var statCollector = setInterval(function() {
  var display = function(str) {
    $('bitrate').innerHTML = str;
  }

  display("No stream");
  if (pc2 && pc2.getRemoteStreams()[0]) {
    if (pc2.getStats) {
      pc2.getStats(function(rawStats) {
        stats = new AugumentedStatsResponse(rawStats);
        var statsString = '';
        var results = stats.result();
        var videoFlowInfo = 'No bitrate stats';
        for (var i = 0; i < results.length; ++i) {
          var res = results[i];
          statsString += '<h3>Report ';
          statsString += i;
          statsString += '</h3>';
          if (!res.local || res.local === res) {
            statsString += dumpStats(res);
            // The bandwidth info for video is in a type ssrc stats record
            // with googFrameHeightReceived defined.
            // Should check for mediatype = video, but this is not
            // implemented yet.
            if (res.type == 'ssrc' && res.stat('googFrameHeightReceived')) {
              // This is the video flow.
              videoFlowInfo = extractVideoFlowInfo(res, stats);
            }
          } else {
            // Pre-227.0.1445 (188719) browser
            if (res.local) {
              statsString += "<p>Local ";
              statsString += dumpStats(res.local);
            }
            if (res.remote) {
              statsString += "<p>Remote ";
              statsString += dumpStats(res.remote);
            }
          }
        }
        $('receiverstats').innerHTML = statsString;
        display(videoFlowInfo);
      });
      pc1.getStats(function(stats) {
        var statsString = '';
        var results = stats.result();
        for (var i = 0; i < results.length; ++i) {
          var res = results[i];
          statsString += '<h3>Report ';
          statsString += i;
          statsString += '</h3>';
          if (!res.local || res.local === res) {
            statsString += dumpStats(res);
          }
        }
        $('senderstats').innerHTML = statsString;
      });
    } else {
      display('No stats function. Use at least Chrome 24.0.1285');
    }
  } else {
    log('Not connected yet');
  }
  // Collect some stats from the video tags.
  local_video = $('local-video');
  if (local_video) {
     $('local-video-stats').innerHTML = local_video.videoWidth +
         'x' + local_video.videoHeight;
  }
  remote_video = $('remote-video');
  if (remote_video) {
     $('remote-video-stats').innerHTML = remote_video.videoWidth +
         'x' + remote_video.videoHeight;
  }
}, 1000);

function extractVideoFlowInfo(res, allStats) {
  var description = '';
  var bytesNow = res.stat('bytesReceived');
  if (timestampPrev > 0) {
    var bitRate = Math.round((bytesNow - bytesPrev) * 8 /
                             (res.timestamp - timestampPrev));
    description = bitRate + ' kbits/sec';
  }
  timestampPrev = res.timestamp;
  bytesPrev = bytesNow;
  if (res.stat('transportId')) {
    component = allStats.get(res.stat('transportId'));
    if (component) {
      addresses = allStats.collectAddressPairs(component.id);
      if (addresses.length > 0) {
        description += ' from IP ';
        description += addresses[0].stat('googRemoteAddress');
      } else {
        description += ' no address';
      }
    } else {
      description += ' No component stats';
    }
  } else {
    description += ' No component ID';
  }
  return description;
}

// Dumping a stats variable as a string.
// might be named toString?
function dumpStats(obj) {
  var statsString = 'Timestamp:';
  statsString += obj.timestamp;
  if (obj.id) {
     statsString += "<br>id ";
     statsString += obj.id;
  }
  if (obj.type) {
     statsString += " type ";
     statsString += obj.type;
  }
  if (obj.names) {
    names = obj.names();
    for (var i = 0; i < names.length; ++i) {
       statsString += '<br>';
       statsString += names[i];
       statsString += ':';
       statsString += obj.stat(names[i]);
    }
  } else {
    if (obj.stat('audioOutputLevel')) {
      statsString += "audioOutputLevel: ";
      statsString += obj.stat('audioOutputLevel');
      statsString += "<br>";
    }
  }
  return statsString;
}


// Utility to show the value of a field in a span called name+Display
function showValue(name, value) {
  $(name + 'Display').innerHTML = value;
}
