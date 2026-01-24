# How to Export a DeepRacer Model

Download your trained DeepRacer model for backup, sharing, or deployment to a physical car.

**Physical Model** - For your DeepRacer car

- Downloads immediately as `physicalmodel-<model_name>.tar.gz`
- Ready to deploy to your physical DeepRacer vehicle

**Virtual Model** - For moving between DeepRacer solution instances

- Takes 1-2 minutes to package. Downloads `virtualmodel-<model_name>.tar.gz`
- Contains everything needed to import the model later - reward function, training parameters, and model artifacts
- Perfect for portability across same or different DeepRacer solution instances

## Step-by-Step Guide

### 1. Find Your Model

1. Go to your **Models List View** page
2. Click on the **model name** you want to export
3. This opens the Model Details page

### 2. Access Export Options

1. Look for the **"Actions"** dropdown in the top-right corner
2. Click on **"Actions"** to see export options

### 3. Choose Export Type

**For Physical DeepRacer Car:**

1. Click **"Download Physical Model"**
2. You'll see a green notification: _"Download started for physical model [model-name]"_
3. Your `model.tar.gz` file will download immediately
4. Transfer this file to your DeepRacer car

**For Moving to Same or Different DeepRacer Solution Instance:**

1. Click **"Download Virtual Model"**
2. You'll see a blue notification: _"Please wait. Preparing download for virtual model [model-name]. This process may take 1-2 minutes."_
3. Wait for the packaging to complete in your browser
4. Your complete model package will download automatically

## What's Next?

**Physical Model:**
Upload to your DeepRacer car and start racing!

**Virtual Model:**
[Import](../import/README.md) it into the same or a different DeepRacer solution instance.

---

**Need to import a model?** See [How to Import a Model](../import/README.md)
