require("dotenv").config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const uploadImage = async (base64Image) => {
  console.log("Starting Cloudinary upload...");

  try {
    const data = base64Image.startsWith('data:image')
      ? base64Image
      : `data:image/png;base64,${base64Image}`;

    console.log("Uploading to Cloudinary...");

    const result = await cloudinary.uploader.upload(data);

    console.log("Upload Success:", {
      url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
      format: result.format,
    });

    return result.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return null;
  }
};

if (require.main === module) {
  (async () => {
    console.log("Running Cloudinary upload test...");

    const testBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

    const result = await uploadImage(testBase64);

    console.log("Test Result:", result);
  })();
}

module.exports = {
  uploadImage,
};
