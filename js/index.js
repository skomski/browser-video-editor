(function() {
  'use strict';

  var inputFile;
  var filesElement;
  var Logger;

  function LogOutput(text) { Logger.set(Logger.num++, text); }

  var lastCommand;

  function LogNewCommand(name, text) {
    LogEndCommand(0);
    lastCommand = `${name}-${Logger.num}`;
    LogOutput(`fold:start:${lastCommand}\x1B\[K\n`);
    LogOutput(text);
  }

  function LogEndCommand(exitCode) {
    if (lastCommand) {
      LogOutput(`exit code: ${exitCode}\nfold:end:${lastCommand}\x1B\[K\n`);
    }
    lastCommand = undefined;
  }

  function IsSupported() {
    return document.querySelector && window.URL && window.Worker;
  }

  function parseArguments(text) {
    text = text.replace(/\s+/g, ' ');
    var args = [];
    // Allow double quotes to not split args.
    text.split('"').forEach(function(t, i) {
      t = t.trim();
      if ((i % 2) === 1) {
        args.push(t);
      } else {
        args = args.concat(t.split(" "));
      }
    });
    return args;
  }

  function RunMp4Conversion() {
    if (!inputFile)
      return alert('You need to select a source file!');

    var startTime = document.getElementById("start").value;
    var duration = document.getElementById("duration").value;
    var scale = document.getElementById("scale").value;
    var fps = document.getElementById("fps").value;
    var filters = `fps=${fps},scale=${scale}:-1`;

    var inputName = inputFile.name;

    var reader = new FileReader();

    reader.addEventListener("loadend", function() {
      var createMp4Command =
          `-hide_banner -ss ${startTime} -t ${duration} -i "${inputName}"
           -vf "${filters}" -pix_fmt yuv420p -strict -2 -y output.mp4`;

      RunCommand(
          {
            text : createMp4Command,
            data : [ {name : inputName, data : new Uint8Array(reader.result)} ],
            prettyName : 'convert-to-mp4'
          },
          function(err, buffers) {
            if (err)
              throw err;

            buffers.forEach(function(file) {
              filesElement.appendChild(
                  getDownloadLink(file.data, file.name, 'video/mp4'));
            });
            LogOutput(`\nConverted ${inputName} to mp4!`);
          });
    });
    reader.readAsArrayBuffer(inputFile);
  }

  function RunGifConversion() {
    if (!inputFile)
      return alert('You need to select a source file!');

    var startTime = document.getElementById("start").value;
    var duration = document.getElementById("duration").value;
    var scale = document.getElementById("scale").value;
    var fps = document.getElementById("fps").value;
    var palette = 'palette.jpg';
    var filters = `fps=${fps},scale=${scale}:-1:flags=lanczos`;

    var inputName = inputFile.name;

    var reader = new FileReader();

    reader.addEventListener("loadend", function() {
      var createPaletteCommand =
          `-hide_banner -ss ${startTime} -t ${duration} -i "${inputName}"
       -vf "${filters}, palettegen" -y ${palette}`;

      var createGifCommand =
          `-hide_banner -ss ${startTime} -t ${duration} -i "${inputName}"
       -i ${palette} -lavfi "${filters} [x]; [x][1:v] paletteuse"
       -y output.gif`;

      RunCommand(
          {
            text : createPaletteCommand,
            data : [ {name : inputName, data : new Uint8Array(reader.result)} ],
            prettyName : 'gif-palettegen'
          },
          function(err, buffers) {
            if (err)
              throw err;
            if (buffers.length === 0)
              LogOutput('\nFailed to generate palette for ' + inputName);

            RunCommand(
                {
                  text : createGifCommand,
                  prettyName : 'convert-to-gif',
                  data : [
                    {name : inputName, data : new Uint8Array(reader.result)},
                    {name : buffers[0].name, data : buffers[0].data}
                  ]
                },
                function(err, buffers) {
                  if (err)
                    throw err;
                  buffers.forEach(function(file) {
                    filesElement.appendChild(
                        getDownloadLink(file.data, file.name));
                  });
                  LogOutput(`\nConverted ${inputName} to gif!`);
                });
          });
    });
    reader.readAsArrayBuffer(inputFile);
  }

  function GetRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  function getDownloadLink(fileData, fileName, fileType) {
    if (fileData instanceof Blob) {
      var blob = fileData;
      var src = window.URL.createObjectURL(fileData);
    } else {
      var blob = new Blob([ fileData ]);
      var src = window.URL.createObjectURL(blob);
    }

    var container = document.createElement('div');
    container.className = 'row';

    var col1 = document.createElement('div');
    col1.className = 'col-md-8';

    var col2 = document.createElement('div');
    col2.className = 'col-md-4';

    var header = document.createElement('h3');
    header.textContent = fileName;

    var downloadLink = document.createElement('a');
    downloadLink.download = fileName;
    downloadLink.href = src;
    downloadLink.className = 'btn btn-default btn-block';
    downloadLink.textContent = 'Download';

    var imgurLink = document.createElement('a');
    imgurLink.className = 'btn btn-default btn-block';
    imgurLink.textContent = 'Export to imgur.com';
    imgurLink.onclick =
        function(e) {
      var formData = new FormData();
      formData.append('image', blob);
      $.ajax({
        url : 'https://api.imgur.com/3/image',
        type : 'POST',
        data : formData,
        cache : false,
        contentType : false,
        processData : false,
        headers : {Authorization : 'Client-ID 9b029b06fdc00ba'},
        success : function(data) {
          imgurLink.href = "https://i.imgur.com/" + data.data.id;
          imgurLink.className += ' btn-success';
          imgurLink.target = '_blank';
          imgurLink.textContent = 'Uploaded to ' + imgurLink.href;
        },
        error : function(xhr, textStatus, error) {
          imgurLink.className += ' btn-warning';
          imgurLink.textContent = `${error}: ${xhr.responseJSON.data.error}`;
        },
        xhr : function() {
          var xhr = new window.XMLHttpRequest();
          xhr.upload.addEventListener("progress", function(evt) {
            if (evt.lengthComputable) {
              var percentComplete = evt.loaded / evt.total;
              imgurLink.textContent =
                  'Uploading: ' + percentComplete * 100 + '%';
            } else {
              imgurLink.textContent = 'Uploading...';
            }
          }, false);
          return xhr;
        }
      });
    }

    var streamableLink = document.createElement('a');
    streamableLink.className = 'btn btn-default btn-block';
    streamableLink.textContent = 'Export to streamable.com';
    streamableLink.onclick =
        function(e) {
      var formData = new FormData();
      formData.append('File', blob);
      $.ajax({
        url : 'https://api.streamable.com/upload',
        type : 'POST',
        data : formData,
        cache : false,
        contentType : false,
        processData : false,
        success : function(data) {
          streamableLink.href = "https://streamable.com/" + data.shortcode;
          streamableLink.className += ' btn-success';
          streamableLink.target = '_blank';
          streamableLink.textContent = 'Uploaded to ' + streamableLink.href;
        },
        error : function(xhr, textStatus, error) {
          streamableLink.className += ' btn-warning';
          streamableLink.textContent =
              `${error}: ${xhr.responseJSON.data.error}`;
        },
        xhr : function() {
          var xhr = new window.XMLHttpRequest();
          xhr.upload.addEventListener("progress", function(evt) {
            if (evt.lengthComputable) {
              var percentComplete = evt.loaded / evt.total;
              streamableLink.textContent =
                  'Uploading: ' + percentComplete * 100 + '%';
            } else {
              streamableLink.textContent = 'Uploading...';
            }
          }, false);
          return xhr;
        }
      });
    };

    col2.appendChild(header);
    col2.appendChild(downloadLink);
    col2.appendChild(streamableLink);
    col2.appendChild(imgurLink);

    if (fileName.match(/\.jpeg|\.gif|\.jpg|\.png/)) {
      var img = document.createElement('img');
      img.src = src;
      img.className = 'img-thumbnail';
      col1.appendChild(img);
    } else {
      var video = document.createElement('video');
      video.controls = true;
      video.width = 640;
      video.height = 480;
      video.id = 'preview-video-' + (Math.random() * 1000).toFixed(0);
      video.className = 'video-js vjs-default-skin';

      var source = document.createElement('source');
      source.src = src;
      source.type = fileType || fileData.type;
      video.appendChild(source);

      col1.appendChild(video);
    }

    container.appendChild(col1);
    container.appendChild(col2);
    return container;
  }

  function RunCommand(options, cb) {
    var worker = new Worker("../vendor/ffmpeg-worker-webm.js");
    var lastError;

    worker.onmessage = function(event) {
      var message = event.data;
      switch (message.type) {
      case 'ready':
        break;
      case 'stdout':
        LogOutput(message.data + "\n");
        break;
      case 'stderr':
        LogOutput(message.data + "\n");
        break;
      case 'start':
        break;
      case 'done':
        var buffers = message.data.MEMFS;
        if (cb)
          cb(lastError, buffers);
        worker.terminate();
        break;
      case 'exit':
        LogEndCommand(message.data);
        if (message.data > 0)
          lastError = new Error(`exit code: ${message.data}`);
        break;
      case 'run':
        break;
      default:
        throw new Error('Unhandled switch case', message.type);
      }
    };

    var args = parseArguments(options.text);
    LogNewCommand(options.prettyName || args[0],
                  '$ ffmpeg ' + args.join(' ') + '\n');
    worker.postMessage({type : "run", arguments : args, MEMFS : options.data});
  }

  function handleFileSelect(evt) {
    document.getElementById('inputpreview').innerHTML = '';

    var files = evt.target.files; // FileList object
    if (files.length === 0)
      return;
    inputFile = files[0];

    var newElement = getDownloadLink(inputFile, inputFile.name);
    document.getElementById('inputpreview').appendChild(newElement);
    if (inputFile.name.match(/\.jpeg|\.gif|\.jpg|\.png/)) return;
    var videoPlayer = videojs(newElement.firstChild.firstChild.id);
    videoPlayer.rangeslider();
    videoPlayer.ready(function() {
      videoPlayer.volume(0);
      videoPlayer.play();
      videoPlayer.on('sliderchange', function() {
        var values = videoPlayer.getValueSlider();
        document.getElementById('start').value = values.start;
        document.getElementById('duration').value = values.end - values.start;
      });
      videoPlayer.on('loadedRangeSlider', function() {
        videoPlayer.pause();
        videoPlayer.setValueSlider(0, 5);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function() {
    if (!IsSupported()) {
      alert(`This website is not supported by your browser!
             Update to new Chrome or Firefox.`);
      return;
    }

    document.getElementById('files')
        .addEventListener('change', handleFileSelect, false);

    filesElement = document.querySelector("#outputfiles");

    document.getElementById('uploadForm')
        .onsubmit = function(e) { return false; };

    $('#convertgif')
        .on('click', function(e) {
          RunGifConversion();
          return true;
        });

    $('#convertmp4')
        .on('click', function(e) {
          RunMp4Conversion();
          return true;
        });

    Logger = Log.create();
    Logger.num = 0;
    LogOutput('Loading JavaScript files (it may take a minute)\n');

    window.onerror = function(msg, url, line, col, error) {
      LogOutput(`\n${msg} line: ${line} col: ${col} url: ${url}\n`);
    };

    $('#log')
        .on('click', '.fold',
            function() { return $(this).toggleClass('open'); });

    RunCommand({text : '-version -hide_banner'}, function(err) {
      if (err)
        throw err;
      RunCommand({text : '-formats -hide_banner'}, function(err) {
        if (err)
          throw err;
        LogOutput('Sample commands executing fine!');
      });
    });
  });
})();
