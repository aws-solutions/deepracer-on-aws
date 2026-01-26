# How to Import a DeepRacer Model

Import a previously exported DeepRacer model back into your workspace.

## Before You Start

Make sure you have:

- A model folder exported from DeepRacer (must be under 1GB)
- The folder contains all required files (see tables below)

## Required Files for Model Imports

| File name            | Folder path | Description                                                                                                                                                      |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| .coach_checkpoint    | root/model/ | The coach checkpoint file contains the key for the model checkpoint used in the import.                                                                          |
| ckpt files           | root/model/ | Checkpoint files are snapshots of the model weights taken at different stages during training. They include the ckpt.index, ckpt.data, and ckpt.meta files.      |
| model_metadata.json  | root/       | The model metadata file contains settings that include action space definitions, sensor configuration, and the training algorithm selection.                     |
| reward_function.py   | root/       | A python file that contains the reward function used to train the model.                                                                                         |
| training_params.yaml | root/       | The training_params file contains training job data that includes track and vehicle information, racer and model names, and folder paths for training artifacts. |
| hyperparameters.json | root/       | Contains the model's hyperparameter information such as batch size, loss type, learning rate, and number of epochs.                                              |

## Optional Files for Model Imports

| File name        | Folder path            | Description                                                                  |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------- |
| training-\*.json | root/metrics/training/ | Used to visualize the model's training metrics in the AWS DeepRacer console. |

_Note: If optional files are not included, some functionality like training metrics and reward graphs may not be available on the console._

**💡 Tip:** To see examples of these files and their structure, [export a virtual model](../export/README.md) from an existing trained model. This will give you a complete reference of all required and optional files with the correct folder structure.

## Step-by-Step Guide

### 1. Access Import Feature

1. Go to your **Models List View** page
2. Click the **"Import Model"** button in the top-right corner

### 2. Select Your Model Folder

1. Click **"Choose Folder"** or drag and drop your model folder
2. Wait for the system to validate your files
3. If files are missing, you'll see specific error messages

### 3. Name Your Model

1. Enter a **unique name** for your imported model
2. This can be different from the original model name

### 4. Start Import

1. Click **"Import Model"**
2. You'll see upload progress for each file
3. Wait for the blue notification: _"Model upload started. Please wait while files are being uploaded..."_

### 5. Import Complete

1. You'll see a green notification: _"Model upload completed successfully. Redirecting to model details page..."_
2. The page will automatically redirect to your new model's details
3. Your model will show "Importing" status initially
4. Once complete, you can start evaluations

## Troubleshooting

**Folder too large:**
Your model file exceeds the 1 GB file size limit that solution can import.

**Missing files error:**
Your folder is missing required files. Check the Required Files table above.

**Algorithm mismatch error:**
SAC algorithm only works with Continuous action space. Check your model_metadata.json configuration.

**Metadata file too large:**
Your YAML file exceeds the 10 MB file size limit that the service can create, so your file was edited. This model will not be imported. To remove this error message, select the model from the models list view, and choose Delete.

**Model not valid:**
We can't validate your model because it's been edited. If you have a copy of the model, try to import it again.

---

**Need to export a model?** See [How to Export a Model](../export/README.md)
