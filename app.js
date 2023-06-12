const express = require('express');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const tf = require('@tensorflow/tfjs-node');
const multer = require('multer');
const Jimp = require('jimp');

const app = express();
app.use(express.json());

// MongoDB configuration
mongoose.connect('mongodb://192.168.18.133:27017/projective_tests', {
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

// Upload a test result
app.post('/api/test-results', async (req, res) => {
    try {
        const { testName, imageData } = req.body;

        const processedImageData = await processImageData(imageData);

        const testResult = new TestResult({
            testName,
            imageData: processedImageData,
        });

        await testResult.save();

        res.status(201).json({ message: 'Test result saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save test result' });
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
            const label = req.body.labels[i]; // Assuming the labels are sent in the same order as the images

            const processedImageData = await processImageData(imageData);

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

// Train the Naive Bayesian model
async function trainModel() {
    try {
        const trainData = await TrainData.find();
        const trainDataset = [];

        trainData.forEach((data) => {
            const inputFeature = processImageData(data.imageData);
            const label = data.label;

            trainDataset.push({ inputFeature, label });
        });

        if (trainDataset.length === 0) {
            console.log('No training data available');
            return;
        }

        const inputFeatureSize = trainDataset[0].inputFeature.length;
        const labelSize = [...new Set(trainDataset.map((data) => data.label))].length;

        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 10, inputShape: [inputFeatureSize] }));
        model.add(tf.layers.dense({ units: labelSize, activation: 'softmax' }));
        model.compile({ loss: 'categoricalCrossentropy', optimizer: 'adam' });

        const xsTrain = tf.tensor2d(
            trainDataset.map((data) => data.inputFeature)
        );
        const ysTrain = tf.tensor2d(
            trainDataset.map((data) => oneHotEncodeLabel(data.label, labelSize))
        );

        await model.fit(xsTrain, ysTrain, {
            epochs: 10,
            validationSplit: 0.2,
            shuffle: true,
        });

        const evaluation = model.evaluate(xsTrain, ysTrain);

        console.log(`Training accuracy: ${evaluation[1].dataSync()[0]}`);

        await model.save('./saveModel');

        console.log('Model training completed');
    } catch (error) {
        console.error('Error during model training:', error);
    }
}

// Utility function to one-hot encode labels
function oneHotEncodeLabel(label, labelSize) {
    const encodedLabel = new Array(labelSize).fill(0);
    encodedLabel[label] = 1;
    return encodedLabel;
}

// Utility function to process image data
async function processImageData(imageData) {
    try {
        const image = await Jimp.read(imageData);
        const processedImage = image.resize(256, 256).quality(90);

        return processedImage.getBufferAsync(Jimp.MIME_JPEG);
    } catch (error) {
        console.error('Error processing image data:', error);
        throw error;
    }
}

// Train the model when the server starts
trainModel();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
