# Fetch the base image from public ECR repository
FROM public.ecr.aws/lambda/python:3.12

# Fix OS-level CVEs - AL2023 repos are version-locked, need --releasever=latest to get security patches
RUN microdnf update -y --releasever=latest \
    openssl-fips-provider-latest \
    openssl-snapsafe-libs \
    libnghttp2 \
    && microdnf clean all

# Set up the program in the image
COPY ./routes ${LAMBDA_TASK_ROOT}/routes
COPY lib/reward_func_validator ${LAMBDA_TASK_ROOT}

RUN pip install --upgrade pip
# Here we get all python packages.
RUN pip install --no-cache-dir -r requirements.txt

# Remove unused aws-lambda-rie to fix CVE-2025-61726
RUN rm -f /usr/local/bin/aws-lambda-rie

# Upgrade Pillow to fix CVEs
RUN pip install --no-cache-dir --upgrade pillow==12.2.0

# Pass the name of the function handler as an argument to the runtime
CMD [ "lambda_function.lambda_handler" ]
