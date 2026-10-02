# Fetch the base image from public ECR repository
FROM public.ecr.aws/lambda/python:3.12

# Fix OS-level CVEs - AL2023 repos are version-locked, need --releasever=latest to get security patches
RUN microdnf update -y --releasever=latest \
    openssl-fips-provider-latest \
    openssl-snapsafe-libs \
    libnghttp2 \
    glibc glibc-common \
    libsolv \
    libacl \
    glib2 \
    rpm-libs \
    rpm \
    pcre2 \
    pcre2-syntax \
    libcurl-minimal \
    curl-minimal \
    libxml2 \
    && microdnf clean all

# Set up the program in the image
COPY lib/ ${LAMBDA_TASK_ROOT}/

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r model_optimizer/requirements.txt \
    && rm -rf /var/lang/lib/python3.12/site-packages/tensorflow/include/external/curl \
    && rm -f /usr/local/bin/aws-lambda-rie

# Pass the name of the function handler as an argument to the runtime
CMD [ "model_optimizer.lambda_function.lambda_handler" ]
