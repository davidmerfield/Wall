var APP_KEY = "zl0msi8kqsftxc5";
var editor;
var dbx;
var workingDirectory;
var workingPath;

if (isAuthenticated()) {
  showSections("authed");
  hideSections("unauthed");

  dbx = new Dropbox.Dropbox({
    accessToken: getAccessToken(),
    fetch: fetch
  });

  window.onhashchange = router;
  router();
} else {
  showSections("unauthed");
  hideSections("authed");

  // Set the login anchors href using dbx.getAuthenticationUrl()
  // clientID === APP_KEY per
  // https://www.dropboxforum.com/t5/API-Support-Feedback/Javascript-SDK-CLIENT-ID/td-p/217323
  dbx = new Dropbox.Dropbox({ clientId: APP_KEY, fetch: fetch });
  document.getElementById("authlink").href = dbx.getAuthenticationUrl(
    window.location
  );
}

function router() {
  var queryString = parseQueryString(window.location.hash);

  if (!workingDirectory) {
    renderSelectDirectory();
  } else if (queryString.file) {
    showSections("file");
    hideSections("folder");

    dbx
      .filesDownload({
        path: queryString.file || ""
      })
      .then(function(response) {
        renderFile(response);
      })
      .catch(function(error) {
        console.error(error);
      });
  } else if (queryString.folder) {
    showSections("folder");
    hideSections("file");
    dbx
      .filesListFolder({
        path: queryString.folder || ""
      })
      .then(function(response) {
        renderItems(response.entries);
      })
      .catch(function(error) {
        console.error(error);
      });
  }
}

// Render a file to #file
function renderFile(file) {
  if (workingDirectory) {
    showSections("directory-selected");
    hideSections("select-directory");
  } else {
    showSections("select-directory");
    hideSections("directory-selected");
  }
  var fileContainer = document.getElementById("file-contents");
  fileContainer.style.display = "block";
  fileContainer.innerHTML = "";
  if (file) {
    file.fileBlob.text().then(function(text) {
      fileContainer.innerHTML = marked(text);
    });
  }

  fileContainer.focus();
}

// Render a list of items to #files
function renderItems(items) {
  var filesContainer = document.getElementById("files");
  filesContainer.innerHTML = "";
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

function getAccessToken() {
  if (localStorage.getItem("access_token")) {
    return localStorage.getItem("access_token");
  }

  // Parses the url and gets the access token if it is in the urls hash
  if (parseQueryString(window.location.hash).access_token) {
    localStorage.setItem(
      "access_token",
      parseQueryString(window.location.hash).access_token
    );
    return (window.location = window.location.href.split("#")[0]);
  }

  return null;
}

function logOut() {
  localStorage.setItem("access_token", "");
  window.location = window.location;
}

// If the user was just redirected from authenticating, the urls hash will
// contain the access token.
function isAuthenticated() {
  return !!getAccessToken();
}

// This example keeps both the authenticate and non-authenticated setions
// in the DOM and uses this function to show/hide the correct section.
function showSections(className) {
  document.querySelectorAll("." + className).forEach(function(el) {
    el.style.display = "block";
  });
}

function hideSections(className) {
  document.querySelectorAll("." + className).forEach(function(el) {
    el.style.display = "none";
  });
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
  var postContent = document.getElementById("markdown-content").value;
  document.getElementById("post-wc").innerHTML =
    "Word Count: " + countWords(postContent);

  autosaveTimeout = setTimeout(autoSave, 1000);
}

function countWords(str) {
  str = str
    .replace(/(^\s*)|(\s*$)/gi, "") // handle start and end whitespaces
    .replace(/[ ]{2,}/gi, " ") // merge multiple spaces to 1
    .replace(/\n /, "\n"); // handle newlines
  return str.split(" ").filter(function(s) {
    return s != "";
  }).length;
}

function autoSave() {
  autosaveTimeout = false;
  var postData = {
    body: editor.getContent()
  };
  localforage.setItem("draftpost", postData).then(function() {
    document.getElementById("post-status").innerHTML = "Saved.";
  });
}

// Restore draft posts from local browser storage
localforage.getItem("draftpost", function(err, val) {
  if (val && val.body) {
    var fileContainer = document.getElementById("file-contents");
    fileContainer.innerHTML = val.body;
    document.getElementById("post-status").innerHTML =
      "Opened last saved draft..";
    fileContainer.focus();
  }
});

// Export the content in markdown and save to local
function saveLocally() {
  var textToWrite = document.getElementById("markdown-content").value;
  // console.log(editor.getContent());
  console.log(textToWrite);
  textToWrite = textToWrite.replace(/\n/g, "\r\n");
  var textFileAsBlob = new Blob([textToWrite], { type: "text/plain" });

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
  hideSections("pre-auth");
  hideSections("authed");
  hideSections("folder");
  editor.setContent("");
  localforage.setItem("draftpost", {});
  document.getElementById("file-contents").focus();

  window.location.replace("/");
}

editor = new MediumEditor(".editable", {
  placeholder: false,
  toolbar: {
    buttons: [
      "bold",
      "italic",
      "underline",
      "anchor",
      "h1",
      "h2",
      "quote",
      "orderedlist",
      "unorderedlist"
    ]
  },
  extensions: {
    markdown: new MeMarkdown(function(md) {
      document.querySelector(".markdown").textContent = md;
    })
  }
});

editor.on(document.getElementById("file-contents"), "input", function() {
  saveContent();
});
