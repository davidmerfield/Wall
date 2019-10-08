var APP_KEY = "zl0msi8kqsftxc5";

var markdownEditor = document.querySelector(".markdown");
var editor = new MediumEditor('.editable',
      { placeholder: false,
        toolbar: {
          buttons: ['bold', 'italic', 'underline', 'anchor', 'h1', 'h2', 'quote', 'orderedlist', 'unorderedlist']
        },
        extensions: {
            markdown: new MeMarkdown(function (md) {
              markdownEditor.textContent = md;
    })}
  });

function getAccessToken() {
  if (getAccessTokenFromLocalStorage()) {
    return getAccessTokenFromLocalStorage();
  }

  if (getAccessTokenFromUrl()) {
    localStorage.setItem("access_token", getAccessTokenFromUrl());
    return (window.location = window.location.href.split("#")[0]);
  }

  return null;
}

function logOut() {
  localStorage.setItem("access_token", "");
  window.location = window.location;
}

// Parses the url and gets the access token if it is in the urls hash
function getAccessTokenFromUrl() {
  return parseQueryString(window.location.hash).access_token;
}

function getAccessTokenFromLocalStorage() {
  return localStorage.getItem("access_token");
}

// If the user was just redirected from authenticating, the urls hash will
// contain the access token.
function isAuthenticated() {
  return !!getAccessToken();
}

// Render a file to #file
function renderFile(file) {
  var fileContainer = document.getElementById("file-contents");
  fileContainer.style.display = "block";
  fileContainer.innerHTML = '';
  if(file){
    file.fileBlob.text().then(function(text){
      fileContainer.innerHTML = marked(text);
    });
  }

  fileContainer.focus();
  
  hidePageSection('authed');
  hidePageSection('pre-auth');
}

// Render a list of items to #files
function renderItems(items) {
  var filesContainer = document.getElementById("files");
  filesContainer.innerHTML = '';
  items.forEach(function(item) {
    var li = document.createElement("li");
    if (item[".tag"] === "folder") {
      li.innerHTML =
        "<a href='#folder=" +
        encodeURIComponent(item.path_display) +
        "'>" +
        item.name +
        "</a>";
    } else if (item[".tag"] === "file") {
      li.innerHTML =
        "<a href='/#file=" +
        encodeURIComponent(item.path_display) +
        "'>" +
        item.name +
        "</a>";
    }

    filesContainer.appendChild(li);
  });
}
// This example keeps both the authenticate and non-authenticated setions
// in the DOM and uses this function to show/hide the correct section.
function showPageSection(elementId) {
  document.getElementById(elementId).style.display = "block";
}

function hidePageSection(elementId) {
  document.getElementById(elementId).style.display = "none";
}

function publishToDropbox(){
  if (isAuthenticated()) {
    showPageSection("authed");

    // Create an instance of Dropbox with the access token and use it to
    // fetch and render the files in the users root directory.
    var dbx = new Dropbox.Dropbox({ accessToken: getAccessToken(), fetch: fetch });

    window.onhashchange = router;

    router();

    function router () {

    // We are routing here!
    if (parseQueryString(window.location.hash).file) {
      showPageSection("file");
          hidePageSection("folder");

      dbx
        .filesDownload({
          path: parseQueryString(window.location.hash).file || ""
        })
        .then(function(response) {
          renderFile(response);
        })
        .catch(function(error) {
          console.error(error);
        });
    } else {
      showPageSection("folder");
      hidePageSection("file");
      dbx
        .filesListFolder({
          path: parseQueryString(window.location.hash).folder || ""
        })
        .then(function(response) {
          renderItems(response.entries);
        })
        .catch(function(error) {
          console.error(error);
        });
    }
    }

  } else {
    showPageSection("pre-auth");
    // Set the login anchors href using dbx.getAuthenticationUrl()
    // clientID === APP_KEY per
    // https://www.dropboxforum.com/t5/API-Support-Feedback/Javascript-SDK-CLIENT-ID/td-p/217323
    var dbx = new Dropbox.Dropbox({ clientId: APP_KEY, fetch: fetch });
    var authUrl = dbx.getAuthenticationUrl(window.location);
    document.getElementById("authlink").href = authUrl;
  }
}

// Used to extract a user's access token from a URL hash
function parseQueryString(str) {
  var ret = Object.create(null);

  if (typeof str !== "string") {
    return ret;
  }

  str = str.trim().replace(/^(\?|#|&)/, "");

  if (!str) {
    return ret;
  }

  str.split("&").forEach(function(param) {
    var parts = param.replace(/\+/g, " ").split("=");
    // Firefox (pre 40) decodes `%3D` to `=`
    // https://github.com/sindresorhus/query-string/pull/37
    var key = parts.shift();
    var val = parts.length > 0 ? parts.join("=") : undefined;

    key = decodeURIComponent(key);

    // missing `=` should be `null`:
    // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
    val = val === undefined ? null : decodeURIComponent(val);

    if (ret[key] === undefined) {
      ret[key] = val;
    } else if (Array.isArray(ret[key])) {
      ret[key].push(val);
    } else {
      ret[key] = [ret[key], val];
    }
  });

  return ret;
}

renderFile();

/* autosave loop */
var autosaveTimeout = false;
function saveContent() {
  clearTimeout(autosaveTimeout);
  document.getElementById("post-status").innerHTML = "Saving..";
  autosaveTimeout = setTimeout(autoSave, 1000);
}
function autoSave() {
  autosaveTimeout = false;
  var postData = {
    body: editor.getContent(),
  }
  localforage.setItem('draftpost', postData).then(function(){
    document.getElementById("post-status").innerHTML = "Saved";
  });
}

editor.on(document.getElementById('file-contents'), 'input', function(){
  saveContent();
});

// Restore draft posts from local browser storage
localforage.getItem('draftpost', function(err,val){
  if(val && val.body) {
    var fileContainer = document.getElementById("file-contents");
    fileContainer.innerHTML = val.body;
    document.getElementById("post-status").innerHTML = "Opened last saved draft..";
    fileContainer.focus();
  } 
});

// Export the content in markdown and save to local
function saveLocally() {
  var textToWrite = document.getElementById('markdown-content').value; ; 
  // console.log(editor.getContent());
  console.log(textToWrite);
  textToWrite = textToWrite.replace(/\n/g, "\r\n");
  var textFileAsBlob = new Blob([ textToWrite ], { type: 'text/plain' });
  
  var textToSaveAsURL = window.URL.createObjectURL(textFileAsBlob);
  var fileNameToSaveAs = "test-post.md";

  var downloadLink = document.createElement("a");
  downloadLink.download = fileNameToSaveAs;
  downloadLink.innerHTML = "Download File";
  downloadLink.href = textToSaveAsURL;
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);

  downloadLink.click();                
}

// Reset editor to new - remove local browser draft 
function resetEditor() {
  hidePageSection('pre-auth');
  hidePageSection('authed');
  hidePageSection('folder');
  editor.setContent('');
  localforage.setItem('draftpost', {})
  document.getElementById("file-contents").focus();

  window.location.replace("/");
}