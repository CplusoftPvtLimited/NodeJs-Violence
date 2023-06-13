import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const ImageUploadForm = () => {
  const [selectedImages, setSelectedImages] = useState();
  const [formValues, setFormValues] = useState({
    title: "",
  });

  const [Loader, setLoader] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);

  const handleImagesChange = (event) => {
    const files = Array.from(event.target.files);
    console.log("files ---------------------", files);
    setSelectedImages(files);
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files);
    console.log("files ---------------------", files[0]);
    setSelectedImage(files[0]);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prevValues) => ({
      ...prevValues,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    console.log("IMAGES ----", selectedImages);
    selectedImages.forEach((image, index) => {
      formData.append(`images`, image);
    });
    // formData.append("images", selectedImages);
    formData.append("label", formValues.title);

    try {
      await axios
        .post("http://localhost:5000/api/uploadTrainData", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((req) => {
          if (req.status == 201) {
            alert(req.data.message);
          }
        });
      console.log("Form submitted successfully!");
      // Reset form values and selected images
      setFormValues({
        title: "",
      });
      setSelectedImages([]);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleSubmitSingleImage = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    console.log("IMAGES ----", selectedImage);
    // formData.append("images", selectedImages);
    formData.append(`image`, selectedImage);

    try {
      await axios
        .post("http://localhost:5000/predict", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((req) => {
          if (req.status == 201) {
            alert(req.data.message);
          }
        });
      console.log("Form submitted successfully!");
      // Reset form values and selected images
      setFormValues({
        title: "",
      });
      setSelectedImages([]);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const TrainClickHandler = async () => {
    setLoader(true);
    try {
      await axios.get("http://localhost:5000/trainData").then((request) => {
        if (request.status == 201) {
          setLoader(false);
          alert(request.data.message);
        }
      });
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <div>
      <h1>Image Upload Form</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div>
            <label htmlFor="title">Title:</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formValues.title}
              onChange={handleInputChange}
            />
          </div>
          <div style={{ marginLeft: 10 }}>
            <label htmlFor="images">Select Images:</label>
            <input
              type="file"
              id="images"
              name="images"
              multiple
              onChange={handleImagesChange}
            />
          </div>
        </div>
        <button type="submit">Submit</button>
      </form>

      <div style={{ marginTop: 50, display: "flex", flexDirection: "row" }}>
        <button onClick={() => TrainClickHandler()}>Train Data</button>
        {Loader == true && <div className="loader"></div>}
      </div>

      <div style={{ marginTop: 50, display: "flex", flexDirection: "row" }}>
        <form onSubmit={handleSubmitSingleImage}>
          <div style={{ display: "flex", flexDirection: "row" }}>
            <div style={{ marginLeft: 10 }}>
              <label htmlFor="images">Select Image:</label>
              <input
                type="file"
                id="image"
                name="image"
                onChange={handleImageChange}
              />
            </div>
          </div>
          <button type="submit">Submit</button>
        </form>
      </div>
    </div>
  );
};

export default ImageUploadForm;
