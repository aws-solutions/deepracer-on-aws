# Fetch the base image from public ECR repository
FROM public.ecr.aws/lambda/python:3.12

# Set up the program in the image
COPY ./routes ${LAMBDA_TASK_ROOT}/routes
COPY lib/reward_func_validator ${LAMBDA_TASK_ROOT}

RUN pip install --upgrade pip
# Here we get all python packages.
RUN pip install --no-cache-dir -r requirements.txt

# Remove unused aws-lambda-rie to fix CVE-2025-61726
RUN rm -f /usr/local/bin/aws-lambda-rie

# Upgrade Pillow to fix CVE-2026-25990
RUN pip install --no-cache-dir --upgrade pillow==12.1.1

# Pass the name of the function handler as an argument to the runtime
CMD [ "lambda_function.lambda_handler" ]
