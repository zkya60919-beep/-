> ## Documentation Index
> This page is part of the Image and Video APIs product. Fetch the complete documentation index for Image and Video APIs at: https://cloudinary.com/documentation/llms-image-and-video-apis.txt?referrer=docpage and then use it to discover all relevant pages before exploring further.
> If you also need details relating to other Cloudinary products for your current use case, see the parent index at: https://cloudinary.com/documentation/llms.txt?referrer=docpage

# Customizing uploads


Cloudinary provides a secure and comprehensive API for uploading media assets in bulk from server-side code, directly from the browser, or from a mobile application. When you upload to Cloudinary, your asset isn't only stored: Cloudinary also automatically analyzes and saves important data about each asset, such as format, size, resolution, and prominent colors. This data is automatically indexed to enable searching on those attributes.

The [Upload API](upload_images) requires at least a file source, but also supports a wide range of optional parameters that fall into two groups:

* **Upload control parameters** (covered on this page): options you include in your upload call or upload preset that control what happens during the upload itself, such as naming, storage location, tags, metadata, incoming transformations, and access control. Most of these take effect synchronously as the asset is uploaded and stored. This page also covers the `eval` parameter, which lets you inject JavaScript to dynamically modify upload options before the asset is stored.
* **Post-upload processing parameters** (covered on the [post-upload processing page](upload_parameters_processing)): options you include in your upload call or upload preset that request additional processing to be performed immediately after the asset is uploaded and stored. Even though you specify these options up front, they run asynchronously in the background after the asset is stored, and you can use [webhook notifications](notifications) to monitor when processing is finished. These include moderation, analysis, on-success event handling, and more.

> **TIP**: For a full listing of all the available optional parameters for the upload method, see the [Upload API reference](image_upload_api_reference#upload_optional_parameters).



## File sources

Specifying the file to upload is required for all uploads. Cloudinary supports uploading files from various sources, including from a [local path](#upload_from_a_local_path), a [remote URL](#upload_from_a_remote_url), a [private storage URL](#upload_from_a_private_storage_url) (S3 or Google Cloud storage), a [data stream](#upload_data_stream), a [Base64 data URI](#upload_via_a_base_64_data_uri), or an [FTP URL](#upload_from_an_ftp_url).

### Upload from a local path
You can upload an asset by specifying the **local path** of a media file. For example:

```multi
|ruby 
Cloudinary::Uploader.upload("/home/sample.jpg")
  
|php_2
$cloudinary->uploadApi()->upload("/home/sample.jpg");
 
|python
cloudinary.uploader.upload("/home/sample.jpg")

|nodejs
cloudinary.v2.uploader
.upload("/home/sample.jpg")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("/home/sample.jpg", ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"/home/sample.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "/home/sample.jpg", uploader.UploadParams{})

|android
MediaManager.get().upload("/home/sample.jpg").dispatch();

|swift
let params = CLDUploadRequestParams()
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "/home/sample.jpg")

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=@/path/to/sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'

|cli
cld uploader upload "/home/sample.jpg"
```

### Upload from a remote URL

If your assets are already publicly available online, you can specify their remote **HTTP** or **HTTPS** URLs instead of uploading the actual file or file data. In this case, Cloudinary will retrieve the file from its remote URL and upload it directly to Cloudinary. This option allows for a much faster migration of your existing media files. For example:

```multi
|ruby 
Cloudinary::Uploader.upload("https://www.example.com/sample.jpg")
  
|php_2
$cloudinary->uploadApi()->upload("https://www.example.com/sample.jpg");

|python
cloudinary.uploader.upload("https://www.example.com/sample.jpg")

|nodejs
cloudinary.v2.uploader
.upload("https://www.example.com/sample.jpg")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("https://www.example.com/sample.jpg", 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"https://www.example.com/sample.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "https://www.example.com/sample.jpg", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=https://www.example.com/sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'

|cli
cld uploader upload "https://www.example.com/sample.jpg"
```

> **NOTE**: If the remote HTTP(S) URL is protected with Basic Authentication, include the credentials in the URL you pass in the `file` parameter, for example:

`https://user:password@www.example.com/sample.jpg`.

Use this approach only from a trusted server environment; never embed credentials in client‑side code.

For FTP URLs, see [Upload from an FTP URL](#upload_from_an_ftp_url).

### Upload from a private storage URL (Amazon S3, Google Cloud, or Azure)

If you have existing media files in private object storage (an Amazon S3 bucket, a Google Cloud Storage bucket, or an Azure Blob Storage container), you can upload files from a private storage URL. 

> **NOTES**:
>
> * You can also use your private storage (S3 or Google Cloud bucket, or Azure container) for lazy uploading using the [auto-upload mapping](migration#lazy_migration_with_auto_upload) functionality or for [primary and backup storage](solution_overview#storage).

> * When using your own [backup storage](backups_and_version_management), the backup location shouldn't be touched or modified in any way. Additionally, no archiving policy should be enforced on that location (such as an archive policy to a glacier on S3 buckets).

See the instructions below for your storage provider:

* [Upload from a private Amazon S3 bucket](#upload_from_a_private_amazon_s3_bucket)
* [Upload from a private Google Storage bucket](#upload_from_a_private_google_storage_bucket)
* [Upload from a private Azure Blob Storage container](#upload_from_a_private_azure_blob_storage_container)



#### Upload from a private Amazon S3 bucket

To enable uploading from a private Amazon S3 bucket, your storage bucket must be **allowlisted** and Cloudinary must have read access to your bucket. 

**Step 1: Allowlist your bucket**

1. Add an empty file to your bucket with your cloud name as the filename, under the following folder structure: `.wellknown/cloudinary/<your_cloud_name>`
    * By adding this file, you indicate that you have access to this bucket and that you permit Cloudinary to access and modify this bucket's contents.
    * If you want this bucket to be allowlisted for more than one Cloudinary product environment, you can add an appropriately named file for each cloud name.

**Step 2: Provide Cloudinary with read access**

1. In Amazon's AWS S3 Console, select the relevant bucket.
2. In the Bucket Policy properties, paste the following policy text. 
Keep the `Version` value as shown below, but change `BUCKETNAME` to the name of your bucket. If a policy already exists, append this text to the existing policy:

```javascript
{
  "Version": "2012-10-17",
  "Id": "AWSConsole-AccessLogs-Policy-BUCKETNAME-cloudinary",
  "Statement": [
    {
      "Sid": "AWSConsoleStmt-BUCKETNAME-cloudinary",
       "Effect": "Allow",
       "Principal": {
         "AWS": "232482882421"
      },
       "Action": [
          "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::BUCKETNAME/*"
    }
  ]
}

```

> **NOTES**:
>
> * Amazon S3 bucket names containing a `.` character aren't supported for this purpose.

> * If the objects in your S3 bucket are encrypted using AWS Key Management Service (KMS), you must also allow Cloudinary to use the relevant KMS key or keys.Add the statement shown below to the KMS key policy, replacing the example key ARN values with the ARN or ARNs of the keys used to protect your S3 objects:**Tip**: For testing or proof-of-concept environments, you can temporarily use `"Resource": "*"` instead of listing specific key ARNs.

>   * If Cloudinary still can't access your objects after the bucket policy is in place, verify in the S3 object metadata that the object is encrypted with the same KMS key you granted below. If you rotate or change keys later, update the KMS key policy accordingly.
> ```json
{
  "Sid": "AllowAccessForCloudinary",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::232482882421:root"
  },
  "Action": [
    "kms:Decrypt",
    "kms:DescribeKey"
  ],
  "Resource": [
    "arn:aws:kms:us-west-2:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab"
  ]
}
```

**Step 3: Use the S3 URL in your upload**

After your storage bucket is allowlisted and configured, you can pass the Amazon S3 (`s3://my-bucket/...`) URL in your upload method.

**S3 example:**

```multi
|ruby 
Cloudinary::Uploader.upload("s3://my-bucket/my-path/example.jpg")

|php_2
$cloudinary->uploadApi()->upload("s3://my-bucket/my-path/example.jpg");

|python
cloudinary.uploader.upload("s3://my-bucket/my-path/example.jpg")

|nodejs
cloudinary.v2.uploader
.upload("s3://my-bucket/my-path/example.jpg")
.then(result=>console.log(result)); 

|java
cloudinary.uploader().upload("s3://my-bucket/my-path/example.jpg", 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"s3://my-bucket/my-path/example.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "s3://my-bucket/my-path/example.jpg", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=s3://my-bucket/my-path/example.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af' 

|cli
cld uploader upload "s3://my-bucket/my-path/example.jpg"
```          



#### Upload from a private Google Storage bucket

To enable uploading from a private Google Storage bucket, your storage bucket must be **allowlisted** and Cloudinary must have read access to your bucket.

**Step 1: Allowlist your bucket**

1. Add an empty file to your bucket with your cloud name as the filename, under the following folder structure: `.wellknown/cloudinary/<your_cloud_name>`
    * By adding this file, you indicate that you have access to this bucket and that you permit Cloudinary to access and modify this bucket's contents.
    * If you want this bucket to be allowlisted for more than one Cloudinary product environment, you can add an appropriately named file for each cloud name.

**Step 2: Provide Cloudinary with read access**

1. In your GCP console, go to your Google bucket's main page.
2. Select to edit bucket permissions. 
3. Add `service@cloudinary-gcs-production.iam.gserviceaccount.com` as a member and give it the **Storage Object Viewer** role.

**Step 3: Use the Google Storage URL in your upload**

After your storage bucket is allowlisted and configured, you can pass the Google Storage (`gs://mybucket/...`) URL in your upload method.

**Google Cloud example:**

```multi
|ruby 
Cloudinary::Uploader.upload("gs://my_samples/sample.jpg")
  
|php_2
$cloudinary->uploadApi()->upload("gs://my_samples/sample.jpg");
     
|python
cloudinary.uploader.upload("gs://my_samples/sample.jpg")

|nodejs
cloudinary.v2.uploader
.upload("gs://my_samples/sample.jpg")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("gs://my_samples/sample.jpg", 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"gs://my_samples/sample.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "gs://my_samples/sample.jpg", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=gs://my_samples/sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'   

|cli
cld uploader upload "gs://my_samples/sample.jpg"
```



#### Upload from a private Azure Blob Storage container

To enable uploading from a private Azure Blob Storage container, your container must be **allowlisted** and Cloudinary must have read access to it.

**Step 1: Allowlist your container**

1. Add an empty file to your container with your cloud name as the filename, under the following folder structure: `.wellknown/cloudinary/<your_cloud_name>`
    * By adding this file, you indicate that you have access to this container and that you permit Cloudinary to access its contents.
    * If you want this container to be allowlisted for more than one Cloudinary product environment, you can add an appropriately named file for each cloud name.

**Step 2: Grant admin consent**

As an Azure AD administrator, navigate to the following URL and sign in to grant Cloudinary's service principal access to your Azure tenant:

`https://login.microsoftonline.com/<your_azure_tenant_id>/adminconsent?client_id=40ee32e1-dd7d-43a1-b866-28ca4f6ed1ca`

**Step 3: Provide Cloudinary with read access**

Assign the required roles to Cloudinary's service principal (Client ID: `40ee32e1-dd7d-43a1-b866-28ca4f6ed1ca`) in the [Azure portal](https://portal.azure.com):

1. In your **storage account**, go to **Access Control (IAM)** > **Add role assignment**, and assign the **Storage Blob Delegator** role.
2. In your **container**, go to **Access Control (IAM)** > **Add role assignment**, and assign the **Storage Blob Data Reader** role.

**Step 4: Use the Azure Storage URL in your upload**

After your container is allowlisted and configured, you can pass the Azure Blob Storage URL (`azure://<azure_tenant_id>:<azure_storage_account_name>@<container_name>/...`) in your upload method.

> **TIP**:
>
> To find these values in the Azure portal:

> * **azure_tenant_id**: Go to **Azure Active Directory** > **Overview** > **Tenant ID**

> * **azure_storage_account_name**: The name of your Azure Storage account resource

**Azure Blob Storage example:**

```multi
|ruby 
Cloudinary::Uploader.upload("azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg")

|php_2
$cloudinary->uploadApi()->upload("azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg");

|python
cloudinary.uploader.upload("azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg")

|nodejs
cloudinary.v2.uploader
.upload("azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg")
.then(result=>console.log(result)); 

|java
cloudinary.uploader().upload("azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg", 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'

|cli
cld uploader upload "azure://your-tenant-id:mystorageaccount@mycontainer/sample.jpg"
```

> **INFO**: You can also use your Azure Blob Storage container for [lazy migration with auto-upload mapping](migration#lazy_migration_with_auto_upload). When configuring the auto-upload mapping URL prefix in the Console, use the format:
`azure://<azure_tenant_id>:<azure_storage_account_name>@<container_name>/`

### Upload data stream

You can upload an actual data stream (byte array buffer): 

```multi
|ruby 
Cloudinary::Uploader.upload(File.open("sample.jpg", "rb"))
  
|php_2
$fp = @fopen("/home/sample.jpg", "rb");
$cloudinary->uploadApi()->upload($fd);
    
|python
with open("/home/sample.jpg", 'rb') as input_file:
    cloudinary.uploader.upload(input_file)

|nodejs
const byteArrayBuffer = fs.readFileSync('sample.jpg');
new Promise((resolve) => {
    cloudinary.v2.uploader.upload_stream((error, uploadResult) => {
        return resolve(uploadResult);
    }).end(byteArrayBuffer);
}).then((uploadResult) => {
    console.log(`Buffer upload_stream wth promise success - ${uploadResult.public_id}`);
});
  
|java
File file = new File("<path_to_file>");
Map resource = cloudinary.uploader().upload(new FileInputStream(file), 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription("sample.jpg", File.OpenRead(@"/home/sample.jpg"))};
var uploadResult = cloudinary.Upload(uploadParams);

|go
file, err := os.Open("/home/sample.jpg")
resp, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=@/path/to/sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'
```

> **NOTES**:
>
> * The [Node.js SDK](node_image_and_video_upload#node_js_upload_methods) has a number of upload methods that use the Node.js **stream** functionality.

> * **Python streams and filenames.** When uploading from an in‑memory stream (for example, `io.BytesIO` or `StringIO`) make sure the object exposes a filename so the SDK can correctly encode and send the file content. If no filename is available, uploads may fail with an **“Invalid URL”** response.For example (Python):  
> ```python
from io import BytesIO
binary_content = b"...your bytes..."
buf = BytesIO(binary_content)
buf.name = "file"  # ensure a filename is present
cloudinary.uploader.upload(buf)
```
> If you still encounter issues, log and verify the value you pass to the file parameter to ensure it contains valid file data.

### Upload via a Base64 data URI
You can upload a file by specifying the **Data URI** of the file in Base64 encoding (no larger than 60 MB). For example:

> **NOTE**:
>
> When making direct Upload API calls without using a Cloudinary SDK, make sure the `file` parameter value is **URL-encoded** when sending it in a form-encoded request body (for example, `application/x-www-form-urlencoded`). This prevents reserved characters in the **Data URI** from breaking the payload.

```multi
|ruby 
Cloudinary::Uploader.upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==")
  
|php_2
$cloudinary->uploadApi()->upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==");

|python
cloudinary.uploader.upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==")

|nodejs
cloudinary.v2.uploader
.upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'     

|cli
cld uploader upload "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
```

### Upload from an FTP URL
You can upload a media file by specifying a remote **FTP URL**. For private FTP servers, the username and password must be included as parameters with the FTP URL syntax taking the form: `ftp://<user>:<password>@<host>:<port>/<url-path>`. For example:

```multi
|ruby 
Cloudinary::Uploader.upload("ftp://user1:mypass@ftp.example.com/sample.jpg")
  
|php_2
$cloudinary->uploadApi()->upload("ftp://user1:mypass@ftp.example.com/sample.jpg");

|python
cloudinary.uploader.upload("ftp://user1:mypass@ftp.example.com/sample.jpg")

|nodejs
cloudinary.v2.uploader
.upload("ftp://user1:mypass@ftp.example.com/sample.jpg")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("ftp://user1:mypass@ftp.example.com/sample.jpg", 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"ftp://user1:mypass@ftp.example.com/sample.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "ftp://user1:mypass@ftp.example.com/sample.jpg", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=ftp://user1:mypass@ftp.example.com/sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'   

|cli
cld uploader upload "ftp://user1:mypass@ftp.example.com/sample.jpg"
```



## Identification 

Cloudinary provides various identifiers to help you identify and then deliver your asset. 

* **Public ID** - The primary unique identifier that is used to reference the asset as well as for building dynamic delivery and transformation URLs. If you don't specify a `public_id`, Cloudinary will randomly assign a public ID in the response from the upload API call, although you would generally want to specify a more readable and SEO-friendly public ID.
* **Asset ID** - Cloudinary randomly assigns an asset ID to every uploaded asset, and returns this value in the upload response. This is an automatically generated immutable asset identifier that is fully unique and enables developers to reliably reference the asset programmatically, even if the public ID value changes.
* **Asset folder** - The folder where the asset is located. You can move assets between asset folders and rename an asset folders without affecting the asset's public ID value and delivery URL path. 
* **Display name** - You can change the display name without affecting the asset's public ID value and delivery URL path.

> **NOTE**: Asset folder and Display name are not available on product environments using the legacy fixed folder mode.

### Public ID

Every asset uploaded to Cloudinary is assigned a unique identifier in the form of a public ID, which is a URL-safe string that is used to reference the uploaded resource as well as for building dynamic delivery and transformation URLs. You can also browse and search resources by public IDs in Cloudinary's [Media Library](https://console.cloudinary.com/console/media_library/search) web interface. 

If you don't supply a public ID in the upload API call, you will receive a randomly assigned public ID in the response from the upload API call. A randomly generated `public_id` looks something like this: `8jsb1xofxdqamu2rzwt9q`. The resulting delivery URL for such an asset would be something like:

`https://res.cloudinary.com/cld-docs/image/upload/8jsb1xofxdqamu2rzwt9q.jpg`

You can set the `public_id` parameter when you upload an asset, which is useful when you want your delivery URLs to be more readable and SEO-friendly. For example:

```multi
|ruby 
Cloudinary::Uploader.upload("sample.jpg", 
  public_id: "sample_id")
  
|php_2
$cloudinary->uploadApi()->upload("sample.jpg", 
  ["public_id" => "sample_id"]);
 
|python
cloudinary.uploader.upload("sample.jpg", 
  public_id = "sample_id")

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg", 
  { public_id: "sample_id" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg", 
  ObjectUtils.asMap("public_id", "sample_id"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  PublicId = "sample_id"};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
    PublicID: "sample_id"})

|android
MediaManager.get().upload("sample.jpg")
  .option("public_id", "sample_id").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setPublicId("sample_id")
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params)

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST -F 'file=@/path/to/sample.jpg' -F 'public_id=sample_id' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample.jpg" public_id="sample_id"
```

This section contains the following topics:

* [Public ID naming preferences](#public_id_naming_preferences)
* [Including a path in the public ID](#including_a_path_in_the_public_id)

#### Public ID naming preferences

To tell Cloudinary to use the original name of the uploaded file as its public ID, include the `use_filename` parameter and set it to `true`. The file name will be normalized to include only URL-safe characters, and a set of random characters will also be appended to ensure the uniqueness of the public ID. By also including the `unique_filename` parameter and setting it to `false`, you can tell Cloudinary not to attempt to make the public ID unique, and just use the normalized file name. The following code example will upload the image file with the filename, `sample_file.jpg` and ensure that the public ID of the asset is set to `sample_file`:

```multi
|ruby
Cloudinary::Uploader.upload("sample_file.jpg", 
  use_filename: true, 
  unique_filename: false)
   
|php_2
$cloudinary->uploadApi()->upload("sample_file.jpg", [
    "use_filename" => true, 
    "unique_filename" => false]);

|python
cloudinary.uploader.upload("sample_file.jpg", 
  use_filename = True, 
  unique_filename = False)

|nodejs
cloudinary.v2.uploader
.upload("sample_file.jpg",
  { use_filename: true, 
    unique_filename: false })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample_file.jpg",
  ObjectUtils.asMap(
    "use_filename", "true", 
    "unique_filename", "false"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  UseFilename = true,
  UniqueFilename = false};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
	UseFilename:    api.Bool(true),
	UniqueFilename: api.Bool(false)})

|android
MediaManager.get().upload("sample.jpg")
  .option("use_filename", "true")
  .option("unique_filename", "false").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setUseFileName(true)
  .setUniqueFilename(false)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params)

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST -F 'file=@/path/to/sample.jpg' -F 'use_filename=true' -F 'unique_filename=false' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample_file.jpg" use_filename=true unique_filename=false
```   

##### Choosing a naming method

Cloudinary assigns a random public ID by default. You can control naming by using one of the following approaches:

* **Random public ID (default)**: Best when you prefer non-descriptive IDs (for example, to avoid leaking meaning) and want automatic uniqueness.
* **Original filename + unique suffix** (`use_filename=true`, `unique_filename=true`): Best when you want readable names while avoiding collisions.
* **Original filename as-is** (`use_filename=true`, `unique_filename=false`): Best when you must preserve the exact normalized filename. To intentionally replace an existing asset, enable `overwrite=true`. See [Replacing existing assets](#replacing_existing_assets).
* **Custom public ID** (`public_id="..."`): Best when you want a specific naming convention (for example, SEO slugs or business identifiers). To intentionally replace an existing asset, enable `overwrite=true`. See [Replacing existing assets](#replacing_existing_assets).

If you're uploading from the Media Library UI, you can control default naming behavior using [upload presets](upload_presets), and you can also set a specific public ID per upload in the Media Library [Upload Widget](media_library_for_developers#upload_widget).

> **NOTES**:
>
> * The public ID value for `image` and `video` *asset types* **shouldn't** include the file extension. If you include a `.` character in a public ID, it's simply another character in the public ID value itself. The format (extension) of a media asset is appended to the public\_id when it's delivered. For example, if you specify `myname.mp4` as the public\_id, then the video would be delivered as `myname.mp4.mp4`. 

> * For `raw` asset types only, the file extension _should_ be specified as part of the public\_id.

> * Public IDs can include non-English characters, periods (`.`), forward slashes (`/`), underscores (`_`), and hyphens (`-`).

> * Public ID length: 

>   * If the public ID contains no slashes, it may be up to 255 characters in total. 

>   * If it includes a path (slashes), the 255-character limit applies to the last path segment only, the segment after the final `/` (for example, in `folder1/folder2/image_id`, only `image_id` is counted against that limit). 

> * Public ID values can't begin or end with a space or forward slash (`/`). Additionally, they can't include the following characters: `?, &, #, \, %, <, >`



#### Including a path in the public ID 

The public ID value can include path elements (slashes) for more structured delivery URLs and to assist with SEO. For example:

```multi
|ruby 
Cloudinary::Uploader.upload("sample.jpg", 
  public_id: "path1/path2/my_asset_name")
  
|php_2
$cloudinary->uploadApi()->upload("sample.jpg", 
  ["public_id" => "path1/path2/my_asset_name"]);

|python
cloudinary.uploader.upload("sample.jpg", 
  public_id = "path1/path2/my_asset_name")

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg", 
  { public_id: "path1/path2/my_asset_name" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg", 
  ObjectUtils.asMap("public_id", "path1/path2/my_asset_name"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  PublicId = "path1/path2/my_asset_name"};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
    PublicID: "path1/path2/my_asset_name"})

|android
MediaManager.get().upload("sample.jpg")
  .option("public_id", "path1/path2/my_asset_name").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setPublicId("path1/path2/my_asset_name")
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params)

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST -F 'file=@/path/to/sample.jpg' -F 'public_id=path1/path2/my_asset_name' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample.jpg" public_id="path1/path2/my_asset_name"
```

> **NOTES**:
>
> * You cannot use `v` followed by numeric characters as the name of a path element in your public ID.

> * You cannot use `/images/` or `/videos/` as a path element in your public ID.  Those names are reserved for use with [dynamic SEO suffixes](advanced_url_delivery_options#dynamic_seo_suffixes).

> * It's recommended to avoid using public ID path names starting with 1-3 characters followed by an underscore, such as `my_path`. By default, Cloudinary assumes that URL components following that pattern represent a Cloudinary transformation component. If the first path element of a public_id does follow that pattern, then when delivering assets from that path, you must separate the last transformation component from the path element with a `version` component. For example:
>       ```
      https://res.cloudinary.com/my_cloud/image/upload/t_transf1/t_transf2/v1/my_path/sample.jpg
      ``` 

> * For details on delivering public IDs in a path structure with or without versions, see [Asset versions](image_transformations#asset_versions). 

> * The effect on the [Media Library](https://console.cloudinary.com/console/media_library/search) of including path elements in public IDs depends on whether your product environment is using **fixed folder mode** or **dynamic folder mode**.

>   * If [Dynamic folders](folder_modes) mode is enabled on your product environment, slashes in a public ID do not impact how the asset is organized in the Media Library. Additionally, if in this mode, you should use the new `asset_folder` parameter instead of the `folder` parameter mentioned above to set the Media Library folder. Whether or not you define an asset folder for purposes of organizing assets in the Media Library, if you also want your `public_id` to include slashes, make sure to use one of the options available in that mode to set the public ID path. 

>   * If your product environment is using the legacy fixed folder mode, then including slashes in a public ID will also create folders in the same structure in the Media Library. If an asset is moved to a different folder in the Media Library, that results in a change to the asset's public ID.

### Replacing existing assets

An existing image or video asset will be replaced by a newly uploaded file when `overwrite` is set to `true` and:

* You upload a new media asset while specifying its `public_id` to be the same as an existing asset 
* The asset gets the same public ID as an existing one via the `use_filename=true` upload option
* You use an [upload preset](upload_presets) where one of the above options is applied

If [backups](backups_and_version_management) are enabled for your product environment, then when an asset is replaced, the previous version is backed up and can be restored if needed. 

However, if the original (older) asset has already been generated and accessed, it might already be cached on the CDN. If an end-user accesses the identical URL soon after you overwrote the asset, they will still be accessing a CDN cached version rather than the new updated one. 

You can ensure that a new version of an asset is delivered by setting the optional `invalidate` parameter to `true` when you overwrite an existing asset.  This invalidates the previous media asset throughout the CDN. Note that it usually takes between a few seconds and a few minutes for the invalidation to fully propagate through the CDN. 

> **TIP**: An alternative method of ensuring that the latest versions of assets are delivered is to include version values in your delivery URLs. This method requires updating your delivery URLs in your production code when new versions of an asset are uploaded, but the change takes effect immediately. For details, see [Asset versions](image_transformations#asset_versions).

> **NOTES**:
>
> * Depending on your product environment setup, overwriting an asset may clear the tags, contextual, and structured metadata values for that asset. If you have a [Master admin](dam_admin_users_groups#role_based_permissions) role, you can change this behavior for your product environment in the [Media Library Preferences](dam_admin_media_library_options) pane, so that these field values are retained when new version assets overwrite older ones (unless you specify different values for the `tags`, `context`, or `metadata` parameters as part of your upload).* There are a number of important considerations when using the invalidate functionality. For example, if there is no version number in a URL that includes a public ID with slashes, then by default, those URLs are not invalidated. For details on invalidating media assets, see [Invalidating cached media assets on the CDN](invalidate_cached_media_assets_on_the_cdn). 
> {/note}
> **See also**: [Backups and version management](backups_and_version_management)
> ## Storage
> Cloudinary stores your assets in underlying object storage (Amazon S3 buckets, Google Cloud Storage buckets, or Azure Blob Storage containers) according to its asset type, and also allows you to restrict access to your assets as necessary.

> * [Asset types](#asset_types): Assets are uploaded as type `image`, `video`, or `raw`. You can manually set the type or let Cloudinary automatically do it for you based on the source file.

> * [Delivery types](#delivery_types): Access to your assets can be restricted based on the asset's delivery type: `upload` (public), `private`, or `authenticated`.
> ### Asset types
> Cloudinary supports many different file formats, which are categorized into three different **asset types** (`resource_type` in the API):

> * **image**: Images (including animated images), PDFs, and 3D models. For supported file formats, see [Supported image formats](image_format_support#supported_image_formats). See also [Uploading PDFs](#uploading_pdfs) and [Uploading 3D models](#uploading_3d_models).

> * **video**: All video **and audio** files. Audio files are treated as video files without a visual element, enabling you to apply relevant video transformations to them. For supported file formats, see [Supported video formats](video_transcoding#supported_video_formats) and [Supported audio formats](audio_transformations#supported_audio_formats).

> * **raw**: Any file that isn't identified as an image or video. Raw files are stored as-is and can't be transformed.
> {tip}
> Audio files (e.g., MP3, WAV, FLAC) use the `video` asset type, not `raw`. This allows you to apply transformations like trimming, bitrate control, and format conversion.
> {/tip}
> This section contains the following topics:

> * [Passing the resource_type parameter to your upload call](#passing_the_resource_type_parameter_to_your_upload_call)

> * [The 'auto' resource_type](#the_39_auto_39_resource_type)

> * [Uploading videos](#uploading_videos)

> * [Uploading audio files](#uploading_audio_files)

> * [Uploading PDFs](#uploading_pdfs)

> * [Uploading 3D models](#uploading_3d_models)

> * [Uploading non-media files as raw files](#uploading_non_media_files_as_raw_files)
> #### Passing the resource\_type parameter to your upload call  

> * When [uploading using the REST API](client_side_uploading#uploading_with_a_direct_call_to_the_rest_api), the `resource_type` is part of your upload endpoint. 

> * When uploading using a backend SDK, `image` is the default `resource_type`. When uploading video or raw file types, you must pass the `resource_type` option either with the value `auto` or with the relevant specific asset type. 

> * When using [direct image uploading from the browser](client_side_uploading#direct_uploading_from_the_browser), resource type is set to `auto` by default.

> * Uploading a password-protected PDF as an image asset is not supported. If necessary, you can upload a password-protected PDF by setting the `resource_type` to `raw` in the upload command. However, keep in mind that like any other raw file, you can deliver a raw PDF as is, but [PDF transformations](paged_and_layered_media#delivering_content_from_pdf_files) are not supported for raw assets.
> Note that for simplicity, many of the examples in this guide demonstrate uploading an image file. If you use these code examples as the basis for your own video or raw file uploads, don't forget to add the `resource_type` option.
> {note}
> If you try to upload a file format that isn't supported for a specified `resource_type`, then the upload will fail.
> {/note}
> #### The 'auto' resource\_type
> The `upload` method also supports supplying `auto` as a value for the `resource_type` parameter. When you send this value, Cloudinary automatically detects the asset type of the uploaded file and automatically sets the relevant `resource_type` value for the stored asset. 
> For example:
> ```multi
|ruby 
Cloudinary::Uploader.upload("sample_spreadsheet.xls", 
  resource_type: "auto")
  
|php_2
$cloudinary->uploadApi()->upload("sample_spreadsheet.xls", 
  ["resource_type" => "auto"]);

|python
cloudinary.uploader.upload("sample_spreadsheet.xls", 
  resource_type = "auto")

|nodejs
cloudinary.v2.uploader
.upload("sample_spreadsheet.xls", 
  { resource_type: "auto" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample_spreadsheet.xls", 
  ObjectUtils.asMap("resource_type", "auto"));

|csharp
var uploadResult = cloudinary.Upload("auto", null,
  new FileDescription(@"sample_spreadsheet.xls"));  

|go
resp, err := cld.Upload.Upload(ctx, "sample_spreadsheet.xls", uploader.UploadParams{
    ResourceType: "auto"})

|android
MediaManager.get().upload("sample_spreadsheet.xls")
  .option("resource_type", "auto").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setResourceType(.auto)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample_spreadsheet.xls", params: params)            

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/auto/upload -X POST -F 'file=@/path/to/sample_spreadsheet.xls' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample_spreadsheet.xls" resource_type="auto"
```
> The `auto` value is especially useful when you don't know what type of files your users will upload, or if you are uploading multiple files of different asset types with the same settings. When using `auto` as the `resource_type` along with other upload options, only the upload options relevant to a particular asset type are applied. Any options that work only with a different asset type are silently ignored.
> #### Uploading videos
> Uploading videos generally works the same and supports the same options as uploading images. However, when uploading videos, keep the following guidelines in mind: 

> * The default value for the upload method `resource_type` parameter in SDKs is `image`, so you must set the `resource_type` parameter when uploading videos. You can set the `resource_type` parameter to [auto](#the_39_auto_39_resource_type) to instruct Cloudinary to automatically detect the asset type, or you can set the parameter to `video` if you know in advance that you are uploading a video file. 

> * By default, uploading is performed synchronously, and once finished, the uploaded video is immediately available for transformations and delivery. For videos larger than 100 MB, you will need to use [chunked uploading](#chunked_asset_upload). 

> * There are also [file-size limits](programmable_media_asset_usage_data#usage_limits) for transforming larger videos on the fly. The exact limits depend on your account [plan](https://cloudinary.com/pricing).  Therefore, it's best practice to generate your video transformations [eagerly](eager_and_incoming_transformations#eager_transformations) on upload.
> Here's a simple video upload example:
> ```multi
|ruby 
Cloudinary::Uploader.upload(file, 
  resource_type: "video",
  : <optional_parameters...>)

|php_2
$cloudinary->uploadApi()->upload(file, [
    "resource_type" => "video", 
    "<optional_parameters...>"]);

|python
cloudinary.uploader.upload(file, 
  resource_type = "video", 
  <optional_parameters...>)

|nodejs
cloudinary.v2.uploader
.upload(file, 
  { resource_type: "video", 
    <optional_parameters...> })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload(file, 
  ObjectUtils.asMap(
    "resource_type", "video", 
    "<optional_parameters...>"));

|csharp
cloudinary.Upload(UploadParams params);   

|go
resp, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{
    ResourceType: "video"})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/video/upload -X POST --data '<parameters>'   

|cli
cld uploader upload file resource_type="video" <optional_parameters...>
```
> {tip}
> The [Cloudinary Video Player](cloudinary_video_player) provides a feature-rich and customizable interface to present your uploaded videos to your users and allows you to make use of functionality such as [adaptive bitrate streaming](adaptive_bitrate_streaming) and much more.
> {/tip}
> #### Uploading audio files
> Audio files are treated as video files without a visual element and thus are uploaded in the same way as [videos](#uploading_videos), using `video` as the `resource_type`. For example, uploading a local audio file named **audio_sample.mp3**:
> ```multi
|ruby 
Cloudinary::Uploader.upload("audio_sample.mp3", 
  resource_type: "video")
  
|php_2
$cloudinary->uploadApi()->upload("audio_sample.mp3", 
  ["resource_type" => "video"]);
  
|python
cloudinary.uploader.upload("audio_sample.mp3", 
  resource_type = "video")

|nodejs
cloudinary.v2.uploader
.upload("audio_sample.mp3", 
  { resource_type: "video" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("audio_sample.mp3", 
  ObjectUtils.asMap("resource_type", "video"));

|csharp
var uploadParams = new VideoUploadParams(){
  File = new FileDescription(@"audio_sample.mp3")};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "audio_sample.mp3", uploader.UploadParams{
    ResourceType: "video"})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/video/upload -X POST -F 'file=@/path/to/audio_sample.mp3' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "audio_sample.mp3" resource_type="video"
```
> #### Uploading PDFs
> PDF files are uploaded as an `image` asset type. Since `image` is the default `resource_type`, you don't need to explicitly specify the asset type when uploading PDFs.
> ```multi
|ruby 
Cloudinary::Uploader.upload("sample_document.pdf")
  
|php_2
$cloudinary->uploadApi()->upload("sample_document.pdf");

|python
cloudinary.uploader.upload("sample_document.pdf")

|nodejs
cloudinary.v2.uploader
.upload("sample_document.pdf")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample_document.pdf", 
  ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample_document.pdf")};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "sample_document.pdf", uploader.UploadParams{})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST -F 'file=@/path/to/sample_document.pdf' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli 
cld uploader upload "sample_document.pdf"
```
> Once uploaded, you can deliver the PDF as-is, convert specific pages to images, or generate thumbnails.
> {note}
> Uploading a password-protected PDF as an image asset is not supported. If necessary, you can upload a password-protected PDF by setting the `resource_type` to `raw` in the upload command. However, keep in mind that like any other raw file, you can deliver a raw PDF as-is, but PDF transformations are not supported for raw assets.
> {/note}
> {reading}

> * [Delivering content from PDF files](paged_and_layered_media#delivering_content_from_pdf_files)

> * [Optimizing PDFs](pdf_optimization)

> * [Creating PDF files from images](create_pdf_files_from_images)
> {/reading}
> #### Uploading 3D models
> Cloudinary supports 3D models in [various formats](transformations_on_3d_models#delivering_3d_models_in_different_3d_formats). Where the format requires a set of files (for example, textures or other images used in the model), you should zip the entire folder and upload the single ZIP file to Cloudinary. 
> In order to [use 3D models in the Product Gallery](product_gallery#3d_models) and [perform transformations](transformations_on_3d_models) on them, the 3D model needs to be uploaded as an **image** [asset type](#asset_types) to Cloudinary. 
> ZIP files are normally uploaded as **raw** files if the asset type is not specified. However, Cloudinary is able to detect some 3D models and upload them as **image** types, which is especially useful if [uploading manually](media_library_for_developers#uploading_assets) from within your [Media Library](https://console.cloudinary.com/console/media_library/search).  
> If you are uploading a 3D model programmatically, you can explicitly set `resource_type` to `image`. For example, to upload the 3D model archived in the `sample_3D.zip` file:
> ```multi
|ruby 
Cloudinary::Uploader.upload("sample_3D.zip", 
  resource_type: "image")
  
|php_2
$cloudinary->uploadApi()->upload("sample_3D.zip", 
  ["resource_type" => "image"]);

|python
cloudinary.uploader.upload("sample_3D.zip", 
  resource_type = "image")

|nodejs
cloudinary.v2.uploader
.upload("sample_3D.zip", 
  { resource_type: "image" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample_3D.zip", 
  ObjectUtils.asMap("resource_type", "image"));

|csharp
var uploadParams = new ImageUploadParams(){  // by default, ResourceType is already set to "image"
  File = new FileDescription(@"sample_3D.zip")};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "sample3D.zip", uploader.UploadParams{ResourceType: "image"})

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST -F 'file=@/path/to/sample_3D.zip' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli 
cld uploader upload "sample_3D.zip" resource_type="image"
```
> {reading}

> * [Using 3D models in the Product Gallery](product_gallery#3d_models)

> * [Transformations on 3D models](transformations_on_3d_models)
> {/reading}
> #### Uploading non-media files as raw files
> Any file that is not an image or video file is treated as a 'raw' file. Raw files are stored as-is when uploaded to Cloudinary. No transformations on uploaded raw files are available. However, you can deliver your raw assets through a dynamic CDN URL in the same way you deliver image and video assets.
> {note}
> Although the public IDs of image and video files do not include the file's extension, public IDs of raw files must include the original file's extension.
> {/note}
> ```multi
|ruby 
Cloudinary::Uploader.upload("sample_spreadsheet.xls", 
  resource_type: "raw")
  
|php_2
$cloudinary->uploadApi()->upload("sample_spreadsheet.xls", 
  ["resource_type" => "raw"]);

|python
cloudinary.uploader.upload("sample_spreadsheet.xls", 
  resource_type = "raw")

|nodejs
cloudinary.v2.uploader
.upload("sample_spreadsheet.xls", 
  { resource_type: "raw" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample_spreadsheet.xls", 
  ObjectUtils.asMap("resource_type", "raw"));

|csharp
var uploadParams = new RawUploadParams(){  // by default, ResourceType is already set to "raw"
  File = new FileDescription(@"sample_spreadsheet.xls")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "sample_spreadsheet.xls", uploader.UploadParams{
    ResourceType: "raw"})

|android
MediaManager.get().upload("sample_spreadsheet.xls")
  .option("resource_type", "raw").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setResourceType(.raw)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample_spreadsheet.xls", params: params)              

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/raw/upload -X POST -F 'file=@/path/to/sample_spreadsheet.xls' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample_spreadsheet.xls" resource_type="raw"
```
> Here's a sample response of a raw upload call, which is slightly different from an [image or video upload response](#upload_response):
> ```json
{
    "asset_id": "6b6f9976e6c3b438df6cdf51734f81e5",
    "public_id": "sample_spreadsheet.xls",
    "version": 1719316399,
    "version_id": "ca83ac916653dbc56f2a535ec11b800f",
    "signature": "99b492e6723b0e2f68e41c986a3fdaa04bb99e33",
    "resource_type": "raw",
    "created_at": "2024-06-25T11:53:19Z",
    "tags": [],
    "bytes": 6144,
    "type": "upload",
    "etag": "6155c9616c0f4701be72e8695710331f",
    "placeholder": false,
    "url": "http://res.cloudinary.com/cld-docs/raw/upload/v1719316399/sample_spreadsheet.xls",
    "secure_url": "https://res.cloudinary.com/cld-docs/raw/upload/v1719316399/sample_spreadsheet.xls",
    "asset_folder": "",
    "display_name": "sample_spreadsheet.xls",
    "original_filename": "sample_spreadsheet",
    "api_key": "614335564976464"
}
```
> 
> ##### Converting raw files
> The `raw_convert` upload parameter enables you to perform content conversion operations on the files you upload. Depending on the option specified for this parameter, you can either convert raw files to other formats or generate related raw files that can be used in conjunction with the image or video file you uploaded. Some of these are asynchronous operations and others are synchronous as detailed below.
> For example: 

> * Specify `aspose` as the value for your `raw_convert` parameter when uploading an Office document to instruct the [Aspose Document Conversion](aspose_document_conversion_addon) add-on to generate a PDF image file from your `raw` office document. (Asynchronous)

> * Specify `google_speech` when uploading a video to instruct the [Google AI Video Transcription](google_ai_video_transcription_addon) add-on to generate an automatic transcript `raw` file from your uploaded video. (Asynchronous)

> * Specify `extract_text` when uploading a PDF file to extract all the text from the PDF file and store it in a `raw` file. The extracted text is stored in a JSON file with a public ID in the format: **[pdf\_public\_id].extract_text.json**. The full URL of the generated JSON file is included in the upload response.  Unlike the above `raw_convert` options, this option doesn't require registering for an add-on. (Synchronous)
>     {tip:title=Tips:}

>     * The text extraction result using the `extract_text` option may be different than the result you get if you use the [OCR text detection and extraction](ocr_text_detection_and_extraction_addon) add-on. For example, the OCR add-on includes exact coordinates of each line of text. Additionally, if your PDF contains images with text, the OCR add-on will capture this text, but the `raw_convert:"extract_text"` option will not.

>     * You apply these options using the **Upload Preset > Add-ons** page of the Console Settings. This includes the **Extract Text** option, even though that option doesn't require an add-on.
>     {/note} 
> #### Troubleshooting: Illustrator PDF detected as AI (or AI detected as PDF)
> Some Adobe Illustrator files and Illustrator-created PDFs include metadata that can cause the uploaded asset’s **format** to be detected as **AI** or **PDF** interchangeably. Since both **PDF** and **AI** are supported under the **image** asset type, the asset remains fully deliverable, but the detected `format` may not match your expectation.
> **Options**
> 1. **Deliver as PDF via URL extension (no other changes):**  
>     If an uploaded file was detected as AI, you can request the original as a PDF by appending `.pdf` to the delivery URL, for example:  
>     `https://res.cloudinary.com/<cloud_name>/image/upload/<public_id>.pdf`  
>     See: [https://cloudinary.com/documentation/image_format_support#delivering_in_a_different_format](https://cloudinary.com/documentation/image_format_support#delivering_in_a_different_format)
> 2. **Set PDF explicitly on upload (incoming transformation):**  
>     Apply an incoming transformation that sets the format to PDF. For example (Node.js SDK):
>     ```js
    const result = await cloudinary.v2.uploader.upload("myfile.ai", {
      resource_type: "image",
      transformation: [{ format: "pdf" }]
    });
    ```
>     You can also embed this in an [upload preset](/documentation/upload_presets#creating_and_managing_upload_presets).
> 3. **Bypass detection by uploading as raw:**  
>     If you need to preserve the file exactly as uploaded and don't require image transformations, upload as raw:
>     ```js
    const result = await cloudinary.v2.uploader.upload("myfile.pdf", {
      resource_type: "raw"
    });
    ```
>     Note: Transformations aren't supported for [raw uploads](/documentation/upload_parameters#asset_types).
> 4. **Account configuration for paid plans:**  
>     If you consistently upload AI/PDF assets and want the uploaded file extension to take precedence when the detection is AI or PDF, contact [Cloudinary Support](https://support.cloudinary.com/) to enable a product-environment option that prefers the uploaded .pdf/.ai extension in these cases.
> ### Delivery types
> By default, when uploading assets to Cloudinary, both the original asset and its transformed versions are publicly available through a CDN. One way to restrict access to your assets is based on the asset's delivery type.
> Cloudinary supports three different delivery types (`type` in the API):

> * `upload` - The asset is publicly available. This is the default type when uploading files.

> * `private` - Original assets are only accessible by a signed URL.

> * `authenticated` - Original assets and all their asset derivations are only accessible through signed URLs.
> {info}
> This section only shows how to apply the `type` as part of your upload command. See the [Media access methods](control_access_to_media) documentation for more information on all the access control methods features and who can access your files and when.
> {/info}
> This section contains the following topics:

> * [Private assets](#private_assets)

> * [Authenticated assets](#authenticated_assets)
> #### Private assets
> You can upload assets as `private` to restrict access to the original asset and only allow access to derived (transformed) versions of the asset. The original asset can be accessed only with a signed URL, but by default, all derived versions of the asset are accessible. You can further restrict access to the derived asset by activating the [Strict Transformations](control_access_to_media#strict_transformations) mode. This mode also prevents access to the derived versions of the asset, except for those that have been specifically enabled (e.g., with watermarks) that are then available for public delivery to your users. With Strict Transformations enabled, you need to either eagerly generate all derived assets, mark specific transformations as allowed or use signed URLs.
> To upload an asset as a private asset, you set the `type` parameter to `private` (instead of the default `upload`) when uploading the asset to Cloudinary. For example:
> ```multi
|ruby 
Cloudinary::Uploader.upload("sample.jpg", 
  type: "private")
  
|php_2
$cloudinary->uploadApi()->upload("sample.jpg", 
  ["type" => "private"]);

|python
cloudinary.uploader.upload("sample.jpg", 
  type = "private")

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg", 
  { type: "private" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg", 
  ObjectUtils.asMap("type", "private"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  Type = "private"};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
		Type: "private"})

|android
MediaManager.get().upload("sample.jpg")
  .option("type", "private").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setType(.private)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params) 

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/private -X POST -F 'file=@/path/to/sample.jpg' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample.jpg" type="private"
```
> An asset that was uploaded as 'private' cannot be accessed publicly without a signed URL. For example, the following URL returns an error:
> `https://res.cloudinary.com/cld-docs/image/private/sample.jpg`
> {note}
> You can make a private original asset temporarily accessible, for example, to enable a customer to access a stock photo on your site after she purchases it. To do this, you need to deliver a time-limited and signed URL. You can do this directly using the API or you can use the `private_download_url` Utils method, which generates a time-limited, signed URL link to the original asset, which you can then provide to relevant customers. For details, see [Providing time-limited access to private assets](control_access_to_media#providing_time_limited_access_to_private_media_assets).
> {/note}
> #### Authenticated assets
> You can upload assets as `authenticated` to even further restrict access to both the original asset and to the derived (transformed) versions of the asset. Authenticated assets and their derived versions cannot be accessed without some form of authentication. For more information see [Authenticated access to media assets](control_access_to_media#authenticated_access_to_media_assets).
> To upload an asset as an authenticated asset, you set the type (`type` parameter) to `authenticated` (instead of the default `upload`) when uploading the asset to Cloudinary. For example:
> ```multi
|ruby 
Cloudinary::Uploader.upload("sample.jpg", 
  type: "authenticated")
  
|php_2
$cloudinary->uploadApi()->upload("sample.jpg", 
  ["type" => "authenticated"]);

|python
cloudinary.uploader.upload("sample.jpg", 
  type = "authenticated")

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg", 
  { type: "authenticated" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg", 
  ObjectUtils.asMap("type", "authenticated"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  Type = "authenticated"};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
		Type: "authenticated"})

|android
MediaManager.get().upload("sample.jpg")
  .option("type", "authenticated").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setType(.authenticated)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params) 

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/authenticated -X POST -F 'file=@/path/to/sample.jpg' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "sample.jpg" type="authenticated"
```
> If an asset was uploaded as 'authenticated', neither the asset nor any of its derived resources can be accessed without authentication. For example, the following URL returns an error:
> `https://res.cloudinary.com/cld-docs/image/authenticated/sample.jpg`
> ## Transformations
> Cloudinary's transformations can be used while uploading an asset in one of two ways:

> * [Eager transformations](eager_and_incoming_transformations#eager_transformations): Generate transformed assets after the upload completes, so that those transformations will already be available for delivery before your users access them for the first time.

> * [Incoming transformations](eager_and_incoming_transformations#incoming_transformations): Transform the original asset as part of the upload and **before** storing it in Cloudinary. 
> ### Eager transformations
> You can [eagerly generate](eager_and_incoming_transformations#eager_transformations) transformed assets **after** the upload completes, so that those transformations will already be available for delivery before your users access them for the first time. These transformations are generated in addition to storing the original asset as is. Eager transformations are useful for pre-generating transformations:

> * For large images or videos that can take a while to generate.

> * For AI analyses, or other asynchronous operations, such as those performed by some Cloudinary [add-ons](cloudinary_add_ons).

> * In the case that you want to enable **Strict Transformations** and limit access to dynamic URLs.
> {tip}
> You can tell Cloudinary to [generate eager transformations in the background](eager_and_incoming_transformations#eager_asynchronous_transformations) by setting the `eager_async` parameter to true and providing an `eager_notification_url`. 
> {/tip}
> For example, you can eagerly generate transformed assets while uploading them by also specifying the `eager` parameter in the upload method. The following code uploads the `sample.jpg` image and then additionally generates two transformed images: 
> 1. Pad to a width of 400 pixels and height of 300 pixels.
> 2. Crop to a width of 260 pixels and a height of 200 pixels with north gravity. 
> ```multi
|ruby  
Cloudinary::Uploader.upload("sample.jpg",
  eager: [
    {width: 400, height: 300, crop: "pad"}, 
    {width: 260, height: 200, crop: "crop", gravity: "north"}])
 
|php_2
$cloudinary->uploadApi()->upload("sample.jpg", [ 
  "eager" => [
    ["width" => 400, "height" => 300, "crop" => "pad"],
    ["width" => 260, "height" => 200, "crop" => "crop", "gravity" => "north"]]]);

|python
cloudinary.uploader.upload("sample.jpg", 
  eager = [
    {"width": 400, "height": 300, "crop": "pad"},
    {"width": 260, "height": 200, "crop": "crop", "gravity": "north"}])

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg", 
  { eager: [
    { width: 400, height: 300, crop: "pad" }, 
    { width: 260, height: 200, crop: "crop", gravity: "north"} ]})
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg", 
  ObjectUtils.asMap(
    "eager", Arrays.asList(
      new EagerTransformation().width(400).height(300).crop("pad"),
      new EagerTransformation().width(260).height(200).crop("crop").gravity("north"))));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  EagerTransforms = new List<Transformation>(){
   new EagerTransformation().Width(400).Height(300).Crop("pad"),
   new EagerTransformation().Width(260).Height(200).Crop("crop").Gravity("north")}};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
      Eager: "c_pad,h_300,w_400|c_crop,g_north,h_200,w_260"})

|android
MediaManager.get().upload("sample.jpg")
  .option("eager", Arrays.asList(
      new EagerTransformation().width(400).height(300).crop("pad"),
      new EagerTransformation().width(260).height(200).crop("crop").gravity("north"))).dispatch();

|swift
let params = CLDUploadRequestParams()
  .setEager([
    CLDTransformation().setWidth(400).setHeight(300).setCrop("pad"),
    CLDTransformation().setWidth(260).setHeight(200).setCrop("crop").setGravity("north")])
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params)

|cli
cld uploader upload sample.jpg eager='w_400,h_300,c_pad|w_260,h_200,c_crop,g_north'

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=sample.jpg&eager=w_400,h_300,c_pad|w_260,h_200,c_crop,g_north&timestamp=173719931&api_key=436464676&signature=a788d68f86a6f868af'
```
> The delivery URLs for these eagerly generated transformations:
> ![sample.jpg padded to a width of 400 pixels and height of 300 pixels](https://res.cloudinary.com/cld-docs/image/upload/w_400,h_300,c_pad/sample.jpg "with_url:true, with_image:false")
> ![sample.jpg cropped to a width of 260 pixels and a height of 200 pixels with north gravity](https://res.cloudinary.com/cld-docs/image/upload/w_260,h_200,c_crop,g_north/sample.jpg "with_url:true, with_image:false")
> ### Incoming transformations
> [Transform](eager_and_incoming_transformations#incoming_transformations) the original asset as part of the upload and **before** storing it in Cloudinary. This is especially useful to normalize [user-generated content](user_generated_content), for example to limit the resolution size or clip a long video to a maximum duration.
> For example, you can transform an asset while uploading, and before storing, by also specifying the `transformation` parameter in the upload method. The following code limits the dimensions of an uploaded image to a width of 2000 pixels and a height of 1000 pixels:
> ```multi
|ruby
Cloudinary::Uploader.upload("sample.jpg", 
  width: 2000, height: 1000, crop: "limit")
   
|php_2
$cloudinary->uploadApi()->upload("sample.jpg", 
  ["width" => 2000, "height" => 1000, "crop" => "limit"]);
 
|python
cloudinary.uploader.upload("sample.jpg", 
  transformation = {"width": 2000, "height": 1000, "crop": "limit"})

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg",
  { width: 2000, height: 1000, crop: "limit" })
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg",
  ObjectUtils.asMap("transformation", 
    new Transformation().width(2000).height(1000).crop("limit")));

|csharp
var uploadParams = new ImageUploadParams() {
  File = new FileDescription(@"sample.jpg"),
  Transformation = new Transformation().Width(2000).Height(1000).Crop("limit")};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{
		Transformation: "c_scale,h_1000,w_2000/c_limit"})

|android
MediaManager.get().upload("sample.jpg")
  .option("transformation", new Transformation().width(2000).height(1000).crop("limit")).dispatch();

|swift
let params = CLDUploadRequestParams()
  .setTransformation(
    CLDTransformation().setWidth(2000).setHeight(1000).setCrop("limit"))
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params)

|cli
cld uploader upload sample.jpg transformation='[{"width": 2000, "height": 1000, "crop": "limit"}]'

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=sample.jpg&transformation=w_2000,h_1000,c_limit&timestamp=173719931&api_key=436464676&signature=a788d68f86a6f868af'
```  
> ## Metadata
> There are three types of metadata that can be stored with your assets: structured metadata, contextual metadata, and tags. These types of metadata are useful for [searching assets](search_method) based on a value or field value pair, or as a method of marking assets for a particular purpose in your end-user application. 
> This enables other users to decide which assets get which field values or tags, while you use custom metadata API methods to implement the application side based on the values they set. Available metadata options include:

> * [Tags](tags): You can use tags to categorize and organize your assets, bulk delete assets, create ZIP files and JSON lists, and generate PDFs and animated GIFs. Cloudinary also provides various AI-based add-ons to help you automatically tag your assets, where assets are [automatically assigned resource tags](tags#automatically_tagging_assets) based on the detected scene categories.

> * [Contextual metadata](contextual_metadata): custom key-value pairs that you can assign to individual assets.

> * [Structured metadata](structured_metadata): custom fields are defined, along with data types and validations, at a global level, and are added to all assets in the product environment. You assign their values per asset. 
> {tip}
> See the [Custom metadata comparison table](custom_metadata#custom_metadata_comparison_table) for more details on the difference between metadata types.
> {/tip}
> **Example 1: Auto-tagging on upload**
> The following example demonstrates using the [Google Auto Tagging](google_auto_tagging_addon) to automatically tag an uploaded image with all detected categories that have a confidence score higher than 0.6. 
> ```multi
|ruby
Cloudinary::Uploader.upload("ice_skating.jpg", 
  categorization: "google_tagging", auto_tagging: 0.6)

|php_2
$cloudinary->uploadApi()->upload("ice_skating.jpg", 
  ["categorization" => "google_tagging", "auto_tagging" => 0.6]);

|python
cloudinary.uploader.upload("ice_skating.jpg",
  categorization = "google_tagging", auto_tagging = 0.6)

|nodejs
cloudinary.v2.uploader
.upload("ice_skating.jpg", 
  { categorization: "google_tagging", 
    auto_tagging: 0.6 })
.then(result=>console.log(result)); 

|java
cloudinary.uploader().upload("ice_skating.jpg", ObjectUtils.asMap(
  "categorization", "google_tagging", "auto_tagging", "0.6"));

|csharp
var uploadParams = new ImageUploadParams() 
{
  File = new FileDescription(@"ice_skating.jpg"),
  Categorization = "google_tagging",
  AutoTagging = 0.6
};
var uploadResult = cloudinary.Upload(uploadParams);  

|go
resp, err := cld.Upload.Upload(ctx, "ice_skating.jpg", uploader.UploadParams{
		Categorization: "google_tagging",
		AutoTagging:    0.6})

|android
MediaManager.get().upload("ice_skating.jpg")
  .option("categorization", "google_tagging")
  .option("auto_tagging", "0.6").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setCategorization("google_tagging")
  .setAutoTagging(0.6)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "ice_skating.jpg", params: params) 

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST -F 'file=@/path/to/ice_skating.jpg' -F 'categorization=google_tagging' -F 'auto_tagging=0.6' -F 'timestamp=173719931' -F 'api_key=436464676' -F 'signature=a781d61f86a6f818af'

|cli
cld uploader upload "ice_skating.jpg" categorization="google_tagging" auto_tagging=0.6
```
> **Example 2: Adding metadata**
> This example uploads an asset and explicitly sets values for all three types of metadata:

> * **Tags**: `summer`, `new-arrival` 

> * **Contextual metadata**:

>   * Set the `department` as `apparel`

>   * Set the `photographer` as `Jane Doe`

> * **Structured metadata** (must match your configured external IDs):

>   * Set the `sku-id` as `SKU12345678`

>   * Set the `product-id` as `PROD-9081-WHT`
> {note}
> Before running this example in your product environment, [create](media_library_for_developers#managing_structured_metadata_fields) the `sku-id` and `product-id` text fields and replace `my_image.jpg` with the path to an image in your local directory.
> {/note}
> ```multi
|ruby
Cloudinary::Uploader.upload("my_image.jpg",
  tags: ["summer", "new-arrival"],
  context: {
    department: "apparel",
    photographer: "Jane Doe"
  },
  metadata: {
    "sku-id": "SKU12345678",
    "product-id": "PROD-9081-WHT"
  }
)

|php_2
\Cloudinary\Uploader::upload("my_image.jpg", [
    "tags" => ["summer", "new-arrival"],
    "context" => [
        "department" => "apparel",
        "photographer" => "Jane Doe"
    ],
    "metadata" => [
        "sku-id" => "SKU12345678",
        "product-id" => "PROD-9081-WHT"
    ]
]);

|python
cloudinary.uploader.upload("my_image.jpg",
    tags=["summer", "new-arrival"], 
    context={
        "department": "apparel",
        "photographer": "Jane Doe"
    },
    metadata={
        "sku-id": "SKU12345678",
        "product-id": "PROD-9081-WHT"
    }
)

|nodejs
cloudinary.v2.uploader.upload("my_image.jpg", {
  tags: ["summer", "new-arrival"],
  context: {
    department: "apparel",
    photographer: "Jane Doe"
  },
  metadata: {
    "sku-id": "SKU12345678",
    "product-id": "PROD-9081-WHT"
  },
}).then(result => console.log(result));

|java
cloudinary.uploader().upload("my_image.jpg", ObjectUtils.asMap(
    "tags", Arrays.asList("summer", "new-arrival"),
    "context", ObjectUtils.asMap(
        "department", "apparel",
        "photographer", "Jane Doe"
    ),
    "metadata", ObjectUtils.asMap(
        "sku-id", "SKU12345678",
        "product-id", "PROD-9081-WHT"
    )
));

|csharp
var uploadParams = new ImageUploadParams()
{
    File = new FileDescription(@"my_image.jpg"),
    Tags = new List<string> { "summer", "new-arrival" },
    Context = new Dictionary<string, string>
    {
        { "department", "apparel" },
        { "photographer", "Jane Doe" }
    },
    MetadataFields = new StringDictionary
    {
        { "sku-id", "SKU12345678" },
        { "product-id", "PROD-9081-WHT" }
    }
};

var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "my_image.jpg", uploader.UploadParams{
    Tags:            []string{"summer", "new-arrival"},
    Context: map[string]string{
        "department":  "apparel",
        "photographer": "Jane Doe",
    },
    Metadata: map[string]string{
        "sku-id":     "SKU12345678",
        "product-id": "PROD-9081-WHT",
    }
})

|dart
// This SDK doesn't support structured metadata.

|curl
curl https://api.cloudinary.com/v1_1/<cloud_name>/image/upload \
  -X POST \
  -F file=@/path/to/my_image.jpg \
  -F tags="summer,new-arrival" \
  -F context="department=apparel|photographer=Jane Doe" \
  -F metadata="sku-id=SKU12345678|product-id=PROD-9081-WHT" \
  -F api_key=<API_KEY> \
  -F timestamp=<TIMESTAMP> \
  -F signature=<SIGNATURE>

|cli
cld uploader upload "my_image.jpg" \
  tags="summer,new-arrival" \
  context="department=apparel|photographer=Jane Doe" \
  metadata="sku-id=SKU12345678|product-id=PROD-9081-WHT"
```
> 
> ## Eval: Modify upload options before upload
> The `eval` parameter lets you customize the upload by assigning values to parameters before the file is uploaded. This is ideal for conditionally assigning tags, transformations, or metadata based on properties of the uploaded file.
> {tip}
> To inject scripts that run *after* a successful upload, for example, to update tags or metadata based on the upload response, see [On success: Update metadata after upload](upload_parameters_processing#on_success_update_metadata_after_upload).
> {/tip}
> ### How it works
> You write JavaScript to:

> * Use `resource_info` to inspect the file (e.g., `bytes`, `width`, `quality_score`) and set the condition for executing the JavaScript code.

> * Use `upload_options` to modify the upload behavior (e.g., set tags, eager transformations, or metadata)
> {tip}
> To see all the values that you can use with `resource_info` and all the actions you can apply with `upload_options`, see [Eval method syntax](#eval_method_syntax).
> {/tip}
> **Quick Example: Tag files larger than 1MB**

> * Here's the JavaScript code to include in your upload call as a string;
>     ```js
    if (resource_info.bytes > 1000000) {
      upload_options.tags = 'large';
    }
    ```

> * Here's how to include that code in your upload request across various SDKs:
>     ```multi
    |ruby
    Cloudinary::Uploader.upload("photo.jpg", 
      eval: "if (resource_info.bytes > 1000000) {
      upload_options.tags = 'large';}"
    )

    |php_2
    $cloudinary->uploadApi()->upload("photo.jpg", [ 
      "eval" => "if (resource_info.bytes > 1000000) {
        upload_options.tags = 'large';}"
      ]);

    |nodejs
    cloudinary.v2.uploader.upload("photo.jpg", {
      eval: "if (resource_info.bytes > 1000000) {
      upload_options.tags = 'large';}"
    });

    |python
    cloudinary.uploader.upload("photo.jpg",
      eval = "if (resource_info.bytes > 1000000) {
      upload_options.tags = 'large';}"
    )

    |java
    cloudinary.uploader().upload("photo.jpg", 
      Cloudinary.asMap(
        "eval", "if (resource_info.bytes > 1000000) {
      upload_options.tags = 'large';}"
      )
    );

    |csharp
    var uploadParams = new ImageUploadParams(){
      File = new FileDescription(@"photo.jpg"),
      Eval = "if (resource_info.bytes > 1000000) {
        upload_options.tags = 'large';}" 
    };
    var uploadResult = cloudinary.Upload(uploadParams); 

    |go
    resp, err := cld.Upload.Upload(ctx, "photo.jpg", uploader.UploadParams{
      Eval: "if (resource_info.bytes > 1000000) {
        upload_options.tags = 'large';
      }" 
    })

    |android
    MediaManager.get().upload("photo.jpg")
      .option("eval", "if (resource_info.bytes > 1000000) {
        upload_options.tags = 'large';}"
      ).dispatch();

    |swift
    let params = CLDUploadRequestParams()
      .setEval("if (resource_info.bytes > 1000000) {
        upload_options.tags = 'large';
      }"
    )
    var mySig = MyFunction(params)  // returns signature + timestamp from your backend
    params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
    let request = cloudinary.createUploader().signedUpload(
      url: "photo.jpg", params: params)

    |cli
    cld uploader upload photo.jpg -O eval 'if (resource_info.bytes > 1000000) {
      upload_options.tags = 'large';}'

    |curl
    curl https://api.cloudinary.com/v1_1/<cloud_name>/image/upload \
      -X POST --data 'file=photo.jpg&eval=if (resource_info.bytes > 1000000) {upload_options.tags = 'large';};&timestamp=173719931&api_key=<your_key>&signature=<signature>'
    ```
> 
> ### Eval method syntax
> The `eval` parameter accepts a string of up to 4095 characters with the JavaScript code to be evaluated. 
> {tip}
> If you need to execute `eval` code larger than 4095 characters, refer to the [Storing larger eval payload as an authenticated raw file](#storing_larger_eval_payload_as_an_authenticated_raw_file) section for instructions.
> {/tip}
> There are two variables that can be used within the context of the JavaScript code snippet as follows:

> * `resource_info` - to reference the resource info as it would be received in an upload response. For example, `resource_info.width` returns the width of the uploaded resource. The currently supported list of queryable resource info fields includes: `accessibility_analysis`1, `asset_folder`2, `audio_bit_rate`, `audio_codec`, `audio_codec_tag`, `audio_duration`, `audio_frequency`, `audio_profile`, `audio_start_time`, `avg_frame_rate`, `bit_rate`, `bytes`, `channel_layout`, `channels`, `cinemagraph_analysis`, `codec`, `codec_tag`, `compatible`, `colors`1, `color_properties`, `coordinates`, `display_name`2, `duration`, `etag`, `exif`, `faces`, `filename`, `folder`, `format`, `format_duration`, `frame_rate`, `grayscale`, `has_alpha`, `has_audio`, `height`, `ignore_loop`, `illustration_score`, `media_metadata`1, `nb_audio_pckts`, `nb_frames`, `pages`, `phash`1, `phash_mh`, `pix_format`, `predominant`, `profile`, `quality_analysis`1, `quality_score`, `rotation`, `r_frame_rate`, `semi_transparent`, `start_time`, `time_base`, `video_bit_rate`, `video_duration`, `video_start_time`, `width`
> {notes:title=Footnotes}
> 1. Available when also requesting [Semantic data extraction](semantic_data_extraction) and/or [Accessibility analysis](accessibility_analysis).
> 2. Not available on product environments using the legacy fixed folder mode.
* `upload_options` - to assign amended upload parameters as they would be specified in an upload request. For example `upload_options.tags = "new_tag"`.  You can also assign values that would be returned in the response. For example `upload_options.tags = "${resource_info.quality_score}` The following upload options can NOT be amended: `eager_async`, `upload_preset`, `resource_type`, and `type`.

### Examples

**Tag low quality images**

Add the tag 'blurry' to any image uploaded with a quality analysis focus of less than 0.5:

``` multi
|ruby 
Cloudinary::Uploader.upload("user_photo.jpg", 
  quality_analysis: true,
  eval: "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }")

|php_2
$cloudinary->uploadApi()->upload("user_photo.jpg",[ 
    "quality_analysis" => true,
    "eval" => "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }" ]);

|nodejs
cloudinary.v2.uploader
.upload("user_photo.jpg",
  { quality_analysis: true,
    eval: "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }" })
.then(result=>console.log(result)); 

|python
cloudinary.uploader.upload("user_photo.jpg",
  quality_analysis = 1,
  eval = "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }")

|java
cloudinary.uploader().upload("user_photo.jpg", 
  Cloudinary.asMap(
    "quality_analysis", true,
    "eval", "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"user_photo.jpg"),
  QualityAnalysis = true,
  Eval = "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }"};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "user_photo.jpg", uploader.UploadParams{
	QualityAnalysis: api.Bool(true),
	Eval:            "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }"})


|android
MediaManager.get().upload("user_photo.jpg")
  .option("quality_analysis", true)
  .option("eval", "if (resource_info.quality_analysis.focus < 0.5) { upload_options['tags'] = 'blurry' }").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setEval("if (resource_info.quality_analysis.focus < 0.5) { upload_options.tags = 'blurry' }")
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "user_photo.jpg", params: params) 

|cli
cld uploader upload user_photo.jpg quality_analysis=true -O eval 'if(resource_info.quality_analysis.focus<0.5){upload_options["tags"]="blurry";}'

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=user_photo.jpg&quality_analysis=true&eval=\"if(resource_info.quality_analysis.focus<0.5){upload_options[\'tags\']=\'blurry\';}\"&timestamp=173719931&api_key=436464676&signature=a788d68f86a6f868af'
```

**Transform large images**

Apply an eager transformation (`c_fill,w_500,h_500`) to images wider than 1000 pixels:

```multi
|nodejs
cloudinary.v2.uploader.upload("large_image.jpg", {
  eval: "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }"
});

|ruby 
Cloudinary::Uploader.upload("large_image.jpg", 
  eval: "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }")

|php_2
$cloudinary->uploadApi()->upload("large_image.jpg",[ 
    "eval" => "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }" ]);

|nodejs
cloudinary.v2.uploader.upload("large_image.jpg", {
  eval: "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }"
});

|python
cloudinary.uploader.upload("large_image.jpg",
  eval = "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }")

|java
cloudinary.uploader().upload("large_image.jpg", 
  Cloudinary.asMap(
    "eval", "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"large_image.jpg"),
  Eval = "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }"};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "large_image.jpg", uploader.UploadParams{
	Eval: "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }"})

|android
MediaManager.get().upload("large_image.jpg")
  .option("eval", "if (resource_info.width > 1000) { upload_options['eager'] = 'c_fill,w_500,h_500'; }").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setEval("if (resource_info.width > 1000) { upload_options.eager = 'c_fill,w_500,h_500' }")
var mySig = MyFunction(params)
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "large_image.jpg", params: params) 

|cli
cld uploader upload large_image.jpg -O eval 'if(resource_info.width>1000){upload_options["eager"]="c_fill,w_500,h_500";}'

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/upload -X POST --data 'file=large_image.jpg&eval="if(resource_info.width>1000){upload_options[\\'eager\\']=\\'c_fill,w_500,h_500\\';}"&timestamp=173719931&api_key=436464676&signature=a788d68f86a6f868af'
```

**Skip incoming transformation for specific formats**

Conditionally skip an incoming transformation for selected formats (e.g., 3D gltf/glb), and otherwise apply an optimization:

```multi
|ruby
Cloudinary::Uploader.upload("my_model.gltf", 
  eval: 'if (resource_info.format === "gltf" || resource_info.format === "glb") {
  upload_options.transformation = "";
} else {
  upload_options.transformation = "q_auto:good";
}')

|php_2
$cloudinary->uploadApi()->upload("my_model.gltf", [ 
  "eval" => 'if (resource_info.format === "gltf" || resource_info.format === "glb") {
  upload_options.transformation = "";
} else {
  upload_options.transformation = "q_auto:good";
}' ]);

|nodejs
cloudinary.v2.uploader.upload("my_model.gltf", {
  eval: `if (resource_info.format === "gltf" || resource_info.format === "glb") {
  upload_options.transformation = "";
} else {
  upload_options.transformation = "q_auto:good";
}`
});

|python
cloudinary.uploader.upload("my_model.gltf",
  eval = 'if (resource_info.format === "gltf" || resource_info.format === "glb") {
  upload_options.transformation = "";
} else {
  upload_options.transformation = "q_auto:good";
}')

|java
cloudinary.uploader().upload("my_model.gltf", 
  ObjectUtils.asMap(
    "eval", "if (resource_info.format === \"gltf\" || resource_info.format === \"glb\") { upload_options.transformation = \"\"; } else { upload_options.transformation = \"q_auto:good\"; }"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"my_model.gltf"),
  Eval = "if (resource_info.format === \"gltf\" || resource_info.format === \"glb\") { upload_options.transformation = \"\"; } else { upload_options.transformation = \"q_auto:good\"; }"
};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "my_model.gltf", uploader.UploadParams{
  Eval: `if (resource_info.format === "gltf" || resource_info.format === "glb") {
  upload_options.transformation = "";
} else {
  upload_options.transformation = "q_auto:good";
}` })

|android
MediaManager.get().upload("my_model.gltf")
  .option("eval", "if (resource_info.format === \"gltf\" || resource_info.format === \"glb\") { upload_options.transformation = \"\"; } else { upload_options.transformation = \"q_auto:good\"; }")
  .dispatch();

|swift
let params = CLDUploadRequestParams()
  .setParam("eval", value: "if (resource_info.format === \"gltf\" || resource_info.format === \"glb\") { upload_options.transformation = \"\"; } else { upload_options.transformation = \"q_auto:good\"; }")

|cli
cld uploader upload my_model.gltf -O eval 'if (resource_info.format === "gltf" || resource_info.format === "glb") {
  upload_options.transformation = "";
} else {
  upload_options.transformation = "q_auto:good";
}'

|curl
curl https://api.cloudinary.com/v1_1/<cloud_name>/image/upload \
  -X POST --data 'file=my_model.gltf&eval=if (resource_info.format === "gltf" || resource_info.format === "glb") { upload_options.transformation = ""; } else { upload_options.transformation = "q_auto:good"; }&timestamp=173719931&api_key=<your_key>&signature=<signature>'
```

> **TIP**: See [Incoming transformations](/documentation/upload_parameters#incoming_transformations) for more on transforming during upload.

**Extract structured metadata from the filename**

Parse the filename and write into a structured metadata field (ensure the metadata field exists in your schema):

```multi
|ruby
Cloudinary::Uploader.upload("blackweek_2023.png", 
  eval: 'var parts = (resource_info.filename || "").split("_"); 
  if (parts.length > 1) {
  upload_options.metadata = "year=" + parts[1].split(".")[0];
}')

|php_2
$cloudinary->uploadApi()->upload("blackweek_2023.png", [ 
  "eval" => 'var parts = (resource_info.filename || "").split("_"); 
  if (parts.length > 1) {
  upload_options.metadata = "year=" + parts[1].split(".")[0];
}' ]);

|nodejs
cloudinary.v2.uploader.upload("blackweek_2023.png", {
  eval: `var parts = (resource_info.filename || "").split("_"); 
  if (parts.length > 1) {
  upload_options.metadata = "year=" + parts[1].split(".")[0];
}`
});

|python
cloudinary.uploader.upload("blackweek_2023.png",
  eval = 'var parts = (resource_info.filename || "").split("_"); 
  if (parts.length > 1) {
  upload_options.metadata = "year=" + parts[1].split(".")[0];
}')

|java
cloudinary.uploader().upload("blackweek_2023.png", 
  ObjectUtils.asMap(
    "eval", "var parts = (resource_info.filename || \"\").split(\"_\"); if (parts.length > 1) { upload_options.metadata = \"year=\" + parts[1].split(\".\")[0]; }"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"blackweek_2023.png"),
  Eval = "var parts = (resource_info.filename || \"\").split(\"_\"); if (parts.length > 1) { upload_options.metadata = \"year=\" + parts[1].split(\".\")[0]; }"
};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "blackweek_2023.png", uploader.UploadParams{
  Eval: `var parts = (resource_info.filename || "").split("_"); 
  if (parts.length > 1) {
  upload_options.metadata = "year=" + parts[1].split(".")[0];
}` })

|android
MediaManager.get().upload("blackweek_2023.png")
  .option("eval", "var parts = (resource_info.filename || \"\").split(\"_\"); if (parts.length > 1) { upload_options.metadata = \"year=\" + parts[1].split(\".\")[0]; }")
  .dispatch();

|swift
let params = CLDUploadRequestParams()
  .setParam("eval", value: "var parts = (resource_info.filename || \"\").split(\"_\"); if (parts.length > 1) { upload_options.metadata = \"year=\" + parts[1].split(\".\")[0]; }")

|cli
cld uploader upload blackweek_2023.png -O eval 'var parts = (resource_info.filename || "").split("_"); 
  if (parts.length > 1) {
  upload_options.metadata = "year=" + parts[1].split(".")[0];
}'

|curl
curl https://api.cloudinary.com/v1_1/<cloud_name>/image/upload \
  -X POST --data 'file=blackweek_2023.png&eval=var parts = (resource_info.filename || "").split("_"); if (parts.length > 1) { upload_options.metadata = "year=" + parts[1].split(".")[0]; }&timestamp=173719931&api_key=<your_key>&signature=<signature>'
```

{note}
You can set multiple structured metadata fields using a pipe (|), e.g., upload_options.metadata = "year=2023|campaign=blackweek".
{/note}

**Conditionally mark for manual moderation based on focus**

If focus (from quality analysis) exceeds a threshold, flag for manual moderation:

```multi
|ruby
Cloudinary::Uploader.upload("photo.jpg", 
  quality_analysis: true,
  eval: 'if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) {
  upload_options.moderation = "manual";
}')

|php_2
$cloudinary->uploadApi()->upload("photo.jpg", [ 
  "quality_analysis" => true,
  "eval" => 'if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) {
  upload_options.moderation = "manual";
}' ]);

|nodejs
cloudinary.v2.uploader.upload("photo.jpg", {
  quality_analysis: true,
  eval: `if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) {
  upload_options.moderation = "manual";
}`
});

|python
cloudinary.uploader.upload("photo.jpg",
  quality_analysis = True,
  eval = 'if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) {
  upload_options.moderation = "manual";
}')

|java
cloudinary.uploader().upload("photo.jpg", 
  ObjectUtils.asMap(
    "quality_analysis", true,
    "eval", "if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) { upload_options.moderation = \"manual\"; }"));

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"photo.jpg"),
  QualityAnalysis = true,
  Eval = "if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) { upload_options.moderation = \"manual\"; }"
};
var uploadResult = cloudinary.Upload(uploadParams); 

|go
resp, err := cld.Upload.Upload(ctx, "photo.jpg", uploader.UploadParams{
  QualityAnalysis: true,
  Eval: `if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) {
  upload_options.moderation = "manual";
}` })

|android
MediaManager.get().upload("photo.jpg")
  .option("quality_analysis", true)
  .option("eval", "if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) { upload_options.moderation = \"manual\"; }")
  .dispatch();

|swift
let params = CLDUploadRequestParams()
  .setParam("quality_analysis", value: true)
  .setParam("eval", value: "if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) { upload_options.moderation = \"manual\"; }")

|cli
cld uploader upload photo.jpg -O quality_analysis true -O eval 'if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) {
  upload_options.moderation = "manual";
}'

|curl
curl https://api.cloudinary.com/v1_1/<cloud_name>/image/upload \
  -X POST --data 'file=photo.jpg&quality_analysis=true&eval=if ((resource_info.quality_analysis?.focus ?? 0) > 0.6) { upload_options.moderation = "manual"; }&timestamp=173719931&api_key=<your_key>&signature=<signature>'
```

> **TIP**: See also: [Image quality analysis](/documentation/image_quality_analysis) for the focus score (0.0--1.0).

> **NOTES**:
>
> * If using the `eval` parameter in an [upload preset](upload_presets) and you also want to set the `unique_filename` parameter to be false, you need to explicitly set it as false in the `eval`, and not as a separate parameter in the preset (e.g., `upload_options['unique_filename']=false`).

> * If using the `eval` parameter and you also want the upload response to include face coordinates (by adding `faces=true`), you need to explicitly set the parameter to true in the `eval` (`upload_options['faces'] = true`).

> * You can update multiple metadata fields by separating the values with a pipe (<code>&#124;). For example `upload_options.metadata = "quality = ${resource_info.quality_score} | resolution = ${resource_info.quality_analysis.resolution"`

> **TIP**: Take a look at the [profile picture sample project](profile_picture_sample_project), which demonstrates the use of the `eval` parameter for quality analysis on upload in a Next.js app.



### Storing larger eval payload as an authenticated raw file

When your `eval` parameter code exceeds the 4095-character limit, you can store it externally as a raw, authenticated file in your Cloudinary product environment. This method allows you to reference the larger payload securely during uploads.

> **NOTE**:
>
> Eval payloads stored this way must abide by the following restrictions:

> * Maximum file size: 10 KB 

> * Avoid CPU-intensive operation

1. Upload your Javascript file containing the `eval` payload code to your product environment as a raw authenticated asset.
2. In the `eval` parameter of your upload preset or Upload API call, set the value to `#RESOURCE_REF:<public_id>`, where:
   * `#RESOURCE_REF:` indicates that the payload is located in a raw authenticated file within your product environment.
   * `<public_id>` is the public ID of the uploaded file. For example, `_system/parse_taxonomy_on_upload.js`.

**Example**

#### 1. Create the JavaScript file

Create a file named `complex_upload_logic.js` with your eval logic:

```javascript
// Complex upload logic that exceeds the 4095 character limit
if (resource_info.width > 1920) {
  upload_options.eager = 'c_fill,w_1920,h_1080,c_scale|w_1280,h_720,c_scale|w_800,h_600,c_scale';
  upload_options.tags = 'high_resolution,desktop_optimized';
  
  if (resource_info.bytes > 5000000) {
    upload_options.tags += ',large_file';
    upload_options.quality_analysis = true;
    upload_options.accessibility_analysis = true;
  }
} else if (resource_info.width > 1280) {
  upload_options.eager = 'w_1280,h_720,c_scale|w_800,h_600,c_scale';
  upload_options.tags = 'medium_resolution,tablet_optimized';
} else if (resource_info.width > 800) {
  upload_options.eager = 'w_800,h_600,c_scale';
  upload_options.tags = 'low_resolution,mobile_optimized';
}

// Add format-specific processing
if (resource_info.format === 'png' && resource_info.has_alpha) {
  upload_options.tags += ',transparent_background';
  upload_options.eager += '|f_png,fl_preserve_transparency';
} else if (resource_info.format === 'jpg' || resource_info.format === 'jpeg') {
  upload_options.tags += ',photographic';
  upload_options.eager += '|f_jpg,q_auto';
}

// Add metadata based on dimensions
upload_options.metadata = `width=${resource_info.width}|height=${resource_info.height}|aspect_ratio=${(resource_info.width / resource_info.height).toFixed(2)}`;

// Add context information
upload_options.context = `uploaded_at=${new Date().toISOString()}|file_size=${resource_info.bytes}|format=${resource_info.format}`;

// ...more logic, beyond the 4095 characters
```

#### 2. Upload the JavaScript file to Cloudinary

Upload this file as a raw, authenticated asset:

```bash
curl https://api.cloudinary.com/v1_1/<cloud_name>/raw/upload \
  -X POST \
  -F 'file=@complex_upload_logic.js' \
  -F 'public_id=_system/complex_upload_logic.js' \
  -F 'type=authenticated' \
  -F 'api_key=<your_api_key>' \
  -F 'timestamp=<timestamp>' \
  -F 'signature=<signature>'
```

#### 3. Use the stored eval payload in uploads

Now you can reference this stored payload in your upload calls:

```bash
curl https://api.cloudinary.com/v1_1/<cloud_name>/image/upload \
  -X POST \
  -F 'file=@large_image.jpg' \
  -F 'eval=#RESOURCE_REF:_system/complex_upload_logic.js' \
  -F 'api_key=<your_api_key>' \
  -F 'timestamp=<timestamp>' \
  -F 'signature=<signature>'
```

#### 4. Update the stored payload when needed

If you need to modify the logic, simply upload a new version of the file with the same public_id:

```bash
curl https://api.cloudinary.com/v1_1/<cloud_name>/raw/upload \
  -X POST \
  -F 'file=@updated_complex_upload_logic.js' \
  -F 'public_id=_system/complex_upload_logic.js' \
  -F 'overwrite=true' \
  -F 'type=authenticated' \
  -F 'api_key=<your_api_key>' \
  -F 'timestamp=<timestamp>' \
  -F 'signature=<signature>'
```

> **TIP**: To inject scripts that run after a successful upload to update tags or metadata, see [On success: Update metadata after upload](upload_parameters_processing#on_success_update_metadata_after_upload).
