const express = require('express');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const tf = require('@tensorflow/tfjs-node');
const multer = require('multer');
const Jimp = require('jimp');

const app = express();
app.use(express.json());

// MongoDB configuration
mongoose.connect('mongodb://192.168.1.6:27017/projective_tests', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const TestResultSchema = new mongoose.Schema({
    testName: String,
    imageData: {
        type: Buffer,
    },
});

const TrainDataSchema = new mongoose.Schema({
    imageData: {
        type: Buffer,
    },
    label: String,
});

const TestResult = mongoose.model('TestResult', TestResultSchema);
const TrainData = mongoose.model('TrainData', TrainDataSchema);

// Multer configuration for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

app.post('/predict', upload.single('image'), async (req, res) => {
    try {
        const imageData = req.file.buffer; // Assuming the image data is sent in the 'imageData' field of the request body

        const predictedLabel = await predictImageData(imageData);
        res.json({ label: predictedLabel });
    } catch (error) {
        console.error('Error predicting image:', error);
        res.status(500).json({ error: 'Error predicting image' });
    }
});

// Retrieve all test results
app.get('/api/test-results', async (req, res) => {
    try {
        const testResults = await TestResult.find();

        res.json(testResults);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve test results' });
    }
});

// Upload training data
app.post('/api/train-data', upload.array('images'), async (req, res) => {
    try {
        const images = req.files;

        for (let i = 0; i < images.length; i++) {
            const imageData = images[i].buffer;
            const label = req.body.label; // Assuming the labels are sent in the same order as the images

            const processedImageData = await processUploadData(imageData);

            const trainData = new TrainData({
                imageData: processedImageData,
                label,
            });

            await trainData.save();
        }

        res.status(201).json({ message: 'Training data saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save training data' });
    }
});

let inputFeatureSize;

// Train the Naive Bayesian model
async function trainModel() {
    try {
        const trainData = await TrainData.find();

        if (trainData.length === 0) {
            console.log('No training data available');
            return;
        }

        const uniqueLabels = [...new Set(trainData.map((data) => data.label))];
        const labelSize = uniqueLabels.length;

        if (labelSize < 2) {
            console.log('Insufficient number of unique labels');
            return;
        }

        const trainDataset = trainData.map(async (data) => {
            const inputFeature = await processImageData(data.imageData);
            const label = data.label;
            return { inputFeature, label };
        });

        // Wait for all image processing to complete
        const processedDataset = await Promise.all(trainDataset);

        if (processedDataset.length === 0) {
            console.log('Empty training dataset');
            return;
        }

        inputFeatureSize = processedDataset[0].inputFeature.length;

        const xsTrain = tf.tensor2d(
            processedDataset.map((data) => {
                const inputFeature = Array.isArray(data.inputFeature) ? data.inputFeature : [data.inputFeature];
                return inputFeature.flat();
            }),
            [processedDataset.length, inputFeatureSize]
        );

        const ysTrain = tf.oneHot(
            processedDataset.map((data) => uniqueLabels.indexOf(data.label)),
            labelSize
        );

        // Define the model architecture
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [inputFeatureSize] }));
        model.add(tf.layers.dense({ units: labelSize, activation: 'softmax' }));

        // Compile the model
        model.compile({ loss: 'categoricalCrossentropy', optimizer: 'adam', metrics: ['accuracy'] });

        // Train the model
        await model.fit(xsTrain, ysTrain, {
            epochs: 25,
            batchSize: 32,
        });

        console.log('Model trained successfully');
        await model.save('file://./saveModel');
        console.log('Model saved successfully');
    } catch (error) {
        console.error('Error during model training:', error);
    }
}

// // // Function to process image data using Jimp
async function processImageData(imageData) {
    try {
        const image = await Jimp.read(imageData);
        const processedImage = image.resize(256, 256).quality(90);

        const pixelData = Array.from(processedImage.bitmap.data);
        return pixelData;
    } catch (error) {
        console.error('Error processing image data:', error);
        throw error;
    }
}
async function processUploadData(imageData) {
    try {
        // Load the image using Jimp
        const image = await Jimp.read(Buffer.from(imageData));

        // Resize and perform other necessary image processing operations
        const processedImage = image.resize(256, 256).greyscale();

        // Convert the processed image to a buffer or another suitable format
        const processedImageData = await processedImage.getBufferAsync(Jimp.MIME_JPEG);

        return processedImageData;
    } catch (error) {
        console.error('Error processing image data:', error);
        throw error;
    }
}


async function predictImageData(imageData) {
    try {
        const processedImage = await processImageData(imageData);
        const inputFeature = Array.isArray(processedImage) ? processedImage : [processedImage];

        // Retrieve the input feature size from the saved model
        const model = await tf.loadLayersModel('file://./saveModel/model.json');
        const inputFeatureSize = model.inputs[0].shape[1];

        const inputTensor = tf.tensor2d([inputFeature], [1, inputFeatureSize]);

        const prediction = model.predict(inputTensor);
        const predictedLabelIndex = tf.argMax(prediction, 1).dataSync()[0];

        const trainData = await TrainData.find();

        if (trainData.length === 0) {
            console.log('No training data available');
            return;
        }

        const uniqueLabels = [...new Set(trainData.map((data) => data.label))];
        console.log(uniqueLabels)
        const labels = uniqueLabels.length > 0 ? uniqueLabels : ['Person Under The Rain', 'Family', 'Human Figure']; // Replace with your own labels
        const predictedLabel = labels[predictedLabelIndex];

        return predictedLabel;
    } catch (error) {
        console.error('Error predicting image data:', error);
        throw error;
    }
}
app.get('/trainData', (req, res) => {
    trainModel();
})// Call this function to train the model during application startup

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});