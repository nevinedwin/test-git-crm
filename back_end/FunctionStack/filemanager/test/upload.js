const uploadToS3 = () => {
  const { files } = document.getElementById("s3Upload");
  if (!files.length) {
    return console.log("Please choose a file to upload first.");
  }
  console.log(files);
  const uploadedFile = files[0];
  const formData = new FormData();
  formData.append("file", uploadedFile);
  formData.append("path", "Berlin/test");
  const options = {
    method: "POST",
    body: formData,
  };
  fetch(
    "https://rlf8brgisk.execute-api.us-west-2.amazonaws.com/dev/api/auth/filemanager/upload",
    options
  );
};
