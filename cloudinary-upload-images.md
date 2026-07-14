> ## Documentation Index
> This page is part of the Image and Video APIs product. Fetch the complete documentation index for Image and Video APIs at: https://cloudinary.com/documentation/llms-image-and-video-apis.txt?referrer=docpage and then use it to discover all relevant pages before exploring further.
> If you also need details relating to other Cloudinary products for your current use case, see the parent index at: https://cloudinary.com/documentation/llms.txt?referrer=docpage

# Upload


Using Cloudinary's upload capabilities, you can upload media assets in bulk with a variety of options for customizing how they will be uploaded.

When you upload to Cloudinary, your asset isn't only stored, but Cloudinary also automatically analyzes and saves important data about each asset, such as format, size, resolution, prominent colors, etc. This data is also automatically indexed to enable searching on those attributes.  

Cloudinary provides a secure and comprehensive API for easily uploading media files from server-side code, directly from the browser or from a mobile application. For full details, see the [Upload API reference](image_upload_api_reference). When needed, you can also use the API to perform unsigned uploads, but with a limited set of available upload parameters as a security precaution.

> **TIP**: :title=New to Cloudinary?

This guide provides an in-depth overview of Cloudinary's Upload API capabilities. To get started with the basics of uploading (and more) in 5 minutes or less, we recommend you first run through one of our [backend SDK quick starts](sdk_quickstarts). 

Each quick start gives you the code to configure your SDK, run your first upload, and then perform a few other common Cloudinary operations, all using your favorite programming language or framework. 

If you haven't moved over your existing assets to Cloudinary yet, you may also want to check out our [Migration guide](migration).

Clara Denari's Mystery Game: The Case of the Sapphire Earrings

Clara found sapphire earrings in her backyard, but her neighbor Mrs. Patterson claims they're a family heirloom and has an old photo to prove it. The problem? The photo is too blurry to tell if the earrings match.
Help Clara upload a restored version using Cloudinary's generative restore effect and find out if Mrs. Patterson's story checks out!

Play the Game

## Upload with Cloudinary MCP in Cursor

The **Asset Management MCP server** enables AI agents to upload images, videos, and raw files to your product environment and generate code that integrates Cloudinary functionality into your applications.

**Learn more**: [Cloudinary MCP servers and LLM tools](cloudinary_llm_mcp)

Use this link to add the Asset Management MCP server to Cursor. Make sure to update your **cloud name**, **API key**, and **API secret** in **Cursor Settings -> MCP Tools**.

  
    
    Add Asset Management MCP
    
    Use this server to perform uploads, to delete, rename, or modify assets, or to manage asset folders and tags.  

  
      
  

> **TIP**: :title=Use the VS Code Extension
You can also upload assets directly from your IDE using the [Cloudinary VS Code Extension](cloudinary_vscode_extension). This eliminates context-switching between your code editor and browser, helping you stay focused on development.

## Quick examples

**Example 1**: Upload the local `hat.jpg` image, and use the filename to set the [public ID](upload_parameters#public_id).

```multi
|ruby 
Cloudinary::Uploader.upload("hat.jpg", 
  use_filename: true)

|php_2
use Cloudinary\Api\Upload\UploadApi;

(new UploadApi())->upload('hat.jpg', [
  'use_filename' => true]);
    
  
|python
cloudinary.uploader.upload("hat.jpg", 
  use_filename = True)

|nodejs
cloudinary.v2.uploader
.upload("hat.jpg", { 
  use_filename: true})
.then(result=>console.log(result));
  
|java
Map params = ObjectUtils.asMap(
    "use_filename", true);
Map uploadResult = cloudinary.uploader().upload(new File("hat.jpg"), params);

|csharp
var uploadParams = new ImageUploadParams()
    {
        File = new FileDescription(@"hat.jpg"),   
        UseFilename = true};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "hat.jpg", uploader.UploadParams{
  UseFilename: api.Bool(true)
})

|android
MediaManager.get().upload("hat.jpg")
   .option("use_filename", "true")
   .dispatch();

let params = CLDUploadRequestParams()
  .setUseFilename(true)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
    url: URL(string:"hat.jpg")!, params: params)

|curl
curl https://api.cloudinary.com/v1_1/demo/image/upload -X POST --data 'file=https://www.example.com/hat.jpg&use_filename=true&timestamp=173719931&api_key=436464676&signature=a788d68f86a6f868af'
```

**Example 2**: 

* Upload a remote image from wikipedia
* Set the [public ID](upload_parameters#public_id) as "wiki_shirt"
* Request [color and quality analysis](semantic_data_extraction)
* Run the [Google Auto Tagging](google_auto_tagging_addon#adding_resource_tags_to_images) add-on 
* Automatically add the detected categories as tags to the asset

```multi
|ruby 
Cloudinary::Uploader.upload("https://upload.wikimedia.org/wikipedia/commons/0/01/Charvet_shirt.jpg", 
  public_id: "wiki_shirt", 
  quality_analysis: true,
  colors: true,
  categorization: "google_tagging",
  auto_tagging: 0.8)

|php_2
use Cloudinary\Api\Upload\UploadApi;

(new UploadApi())->upload('https://upload.wikimedia.org/wikipedia/commons/0/01/Charvet_shirt.jpg', [
  'public_id' => 'wiki_shirt', 
  'quality_analysis' => true,  
  'colors' => true, 
  'categorization' => 'google_tagging', 
  'auto_tagging' => 0.8]);
    
  
|python
cloudinary.uploader.upload("https://upload.wikimedia.org/wikipedia/commons/0/01/Charvet_shirt.jpg", 
  public_id = "wiki_shirt",
  quality_analysis = True, 
  colors = True,  
  categorization = "google_tagging",
  auto_tagging = 0.8)

|nodejs
cloudinary.v2.uploader
.upload("https://upload.wikimedia.org/wikipedia/commons/0/01/Charvet_shirt.jpg", { 
  public_id: "wiki_shirt",
  quality_analysis: true, 
  colors: true, 
  categorization: "google_tagging",
  auto_tagging: 0.8})
.then(result=>console.log(result));
  
|java
Map params = ObjectUtils.asMap(
    "public_id", "wiki_shirt", 
    "quality_analysis", true,
    "colors", true,
    "categorization", "google_tagging", 
    "auto_tagging", 0.8);
Map uploadResult = cloudinary.uploader().upload(new File("https://upload.wikimedia.org/wikipedia/commons/0/01/charvet_shirt.jpg"), params);

|csharp
var uploadParams = new ImageUploadParams()
    {
        File = new FileDescription(@"https://upload.wikimedia.org/wikipedia/commons/0/01/charvet_shirt.jpg"),        
        PublicId = "wiki_shirt",
        QualityAnalysis = true,
        Colors = true,        
        Categorization = "google_tagging",
        AutoTagging = 0.8};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx,"https://upload.wikimedia.org/wikipedia/commons/0/01/charvet_shirt.jpg",uploader.UploadParams{
  PublicID:  "wiki_shirt",
        QualityAnalysis: api.Bool(true),
        Colors: api.Bool(true),        
        Categorization: "google_tagging",
        AutoTagging: 0.8
});

|android
MediaManager.get().upload("https://upload.wikimedia.org/wikipedia/commons/0/01/charvet_shirt.jpg")
   .option("public_id", "wiki_shirt")
   .option("quality_analysis", "true")
   .option("colors", "true")
   .option("categorization", "google_tagging")
   .option("auto_tagging", "0.8")
   .dispatch();

|swift
let params = CLDUploadRequestParams()
  .setPublicId("wiki_shirt")
  .setQualityAnalysis(true)
  .setColors(true)
  .setCategorization(google_tagging)
  .setAutoTagging(0.8)
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
    url: URL(string:"https://upload.wikimedia.org/wikipedia/commons/0/01/charvet_shirt.jpg")!, params: params)

|curl
curl https://api.cloudinary.com/v1_1/demo/image/upload -X POST --data 'file=https://www.example.com/https://upload.wikimedia.org/wikipedia/commons/0/01/charvet_shirt.jpg&public_id="wiki_shirt"&quality_analysis=true&colors=true&categorization="google_tagging"&auto_tagging=true&timestamp=173719931&api_key=436464676&signature=a788d68f86a6f868af'
```


### Programmatic upload with the Node.js SDK video tutorial

Watch this video on how to quickly upload images, videos and other media files to Cloudinary using Cloudinary's Node.js SDK.

  This video is brought to you by Cloudinary's video player - embed your own!Use the controls to set the playback speed, navigate to chapters of interest and select subtitles in your preferred language.
{videoTranscript:publicId=training/upload-programmatically-tutorial-node-js}

#### Tutorial contents This tutorial presents the following topics. Click a timestamp to jump to that part of the video.
#### Supported programming languages
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=0 :sec=11 :player=cld} | Our tutorial uses [Node.js](node_integration) and server-side scripts to demonstrate the upload capabilities. However, we [support many popular programming languages](cloudinary_sdks), including [Ruby](rails_integration), [PHP](php_integration), [Python](dotnet_integration) and more. 
|

#### Write your script
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=0 :sec=32 :player=cld} | Start writing a script that uses Cloudinary's Upload API to get the image into your Cloudinary product environment. Our example requires two different libraries - the [Cloudinary Node.js SDK](node_integration#installation) and [dotenv](https://www.npmjs.com/package/dotenv), which allows your development environment to [use your Cloudinary credentials](node_integration#configuration) and upload the assets in an authenticated way.
|

#### Retrieve your environment variable
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=0 :sec=50 :player=cld} | Retrieve your environment variable from the [API Keys](product_environment_settings#api_keys) page of the Cloudinary Console Settings, then paste it into a **.env** file in your development project. Do not expose your Cloudinary product environment credentials in your site's frontend and public code.
|

> **NOTE**:
>
> You can no longer access your full credentials directly from the Dashboard. Find your **Cloud name** on the [Dashboard](https://console.cloudinary.com/app/home/dashboard), and all credentials, including **API Key**, **API Secret**, and **API environment variable**, on the [API Keys](https://console.cloudinary.com/app/settings/api-keys) page of the Cloudinary Console Settings.

#### Call the Upload API
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=1 :sec=14 :player=cld} | Call the [Cloudinary Upload API](image_upload_api_reference), then [reference the file you want to upload](node_image_and_video_upload#server_side_upload). 
|

#### Add callback functions
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=1 :sec=19 :player=cld} | Add your [callback functions](https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks#callbacks/). This tutorial [uses promises to handle the successes and failures in the code](https://tpiros.dev/blog/promises-in-javascript/).
|

### Ensure script libraries are installed
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=1 :sec=26 :player=cld} | Make sure all of our script's libraries [are properly installed](https://docs.npmjs.com/cli/v7/commands/npm-install) with a simple `npm i` command. If you opening your **package.json** file, you can see all of the packages have been listed as dependencies.
|

#### Run the script and upload the local asset
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=1 :sec=41 :player=cld} | You should have gotten [a successful JSON response](upload_images#upload_response) with lots of data about the uploaded file, including its resolution, file size, format, and more. The file is also now an immediately deliverable asset from a secure, HTTPS URL.
|

#### Upload an asset from a public URL
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=2 :sec=00 :player=cld} | To upload a file from any public URL, [simply enter the full URL of the asset](upload_parameters#upload_from_a_remote_url), instead of the local file path.
|

#### Add parameters to the upload call
{table:class=tutorial-bullets}|  | 
| --- | --- |
|{videotime:id=media :min=2 :sec=19 :player=cld} | You can [edit the file's public ID](upload_parameters#public_id), so the asset is named exactly what you want it to be. It is also possible to [add tags to the asset](image_upload_api_reference#tags_method), so you can easily find and deliver it later. You can even [apply quality analysis features](image_quality_analysis) to provide automation, based on the blurriness or overall size of the asset.

## Basic uploading 

You can upload assets programmatically either by using authenticated uploads that include a signature, or using unauthenticated uploads without a signature but with certain restrictions for security reasons. 

The `upload` API method enables you to upload files with a direct call to Cloudinary by sending an HTTPS POST request to the following Cloudinary REST API URL:

`https://api.cloudinary.com/v1_1/<cloud name>/<resource_type>/upload`

**Where:**

   * `cloud name` is the name of your Cloudinary product environment.
   * `resource_type` is the type of file to upload. Valid values: `image`, `raw`, `video` and `auto` to automatically detect the file type.

For example, to upload an image file to the Cloudinary 'demo' product environment, send an HTTPS POST request to the following URL:

`https://api.cloudinary.com/v1_1/demo/image/upload`

The contents of the POST request you send to Cloudinary depends on whether or not you are making an [authenticated request](#authenticated_requests) or an [unauthenticated request](#unauthenticated_requests).

Uploading is performed synchronously, and once finished, the uploaded asset is immediately available for transformation and delivery. 

> **TIP**:
>
> :title=Tips

> * Use the [auto-upload](migration#lazy_migration_with_auto_upload) feature for lazy migration of all your assets from a remote location to Cloudinary with minimal effort on your side.

> * [Enterprise](https://cloudinary.com/pricing#pricing-enterprise) customers can set up their account to use an [EU or AP data center](image_upload_api_reference#alternative_data_centers_and_endpoints_premium_feature) with the endpoints becoming `api-eu.cloudinary.com` or `api-ap.cloudinary.com` respectively.

> * Audio files (e.g., MP3, WAV, FLAC) use the `video` asset type, not `raw`. This allows you to apply transformations like trimming, bitrate control, and format conversion. For details, see [Uploading audio files](upload_parameters#uploading_audio_files).

### Authenticated requests

Authenticated upload requests are performed over HTTPS using a secure protocol and include an authentication signature that's generated based on your product environment's `cloud_name`, `api_key` and `api_secret` parameters. 

#### Upload with Cloudinary backend SDKs

Cloudinary's [backend SDKs](backend_sdks) wrap the [Upload endpoint](image_upload_api_reference#upload) and automatically generate the authentication signature based on the product environment credentials provided in your SDK configuration. When using an SDK to upload, the only required parameter is the `file` to upload. 

For more details on uploading with SDKs, see the **Upload** page of the relevant [backend SDK](backend_sdks) guide.


**Upload SDK syntax**

The Cloudinary `upload` SDK methods perform authenticated upload API calls over HTTPS using the following syntax:
 
```multi
|ruby 
Cloudinary::Uploader.upload(file, options = {})
  
|php_2
$cloudinary->uploadApi()->upload($file, $options = []);

|python
cloudinary.uploader.upload(file, **options)

|nodejs
cloudinary.v2.uploader.upload(file, options).then(callback);
  
|java
cloudinary.uploader().upload(Object file, Map options);

|csharp
cloudinary.Upload(UploadParams params); 

|go
resp, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{})

|android
MediaManager.get().upload(file).dispatch();

|swift
cloudinary.createUploader().signedUpload(url: file, params: params) 

```

For example, a simple upload of the `sample.jpg` file:

```multi
|ruby 
Cloudinary::Uploader.upload("sample.jpg")
  
|php_2
$cloudinary->uploadApi()->upload("sample.jpg");
  
|python
cloudinary.uploader.upload("sample.jpg")

|nodejs
cloudinary.v2.uploader
.upload("sample.jpg")
.then(result=>console.log(result)); 
  
|java
cloudinary.uploader().upload("sample.jpg", ObjectUtils.emptyMap());

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg")};
var uploadResult = cloudinary.Upload(uploadParams);

|go
resp, err := cld.Upload.Upload(ctx, "sample.jpg", uploader.UploadParams{})

|android
MediaManager.get().upload("sample.jpg").dispatch();

|swift
let params = CLDUploadRequestParams()
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUpload(
  url: "sample.jpg", params: params) 
```

#### Upload via the REST upload endpoint

You can use Cloudinary's REST API directly for authenticated uploads. The Cloudinary `upload` endpoint performs an authenticated upload API call over HTTPS using the following syntax:

```multi
|curl
https://api.cloudinary.com/v1_1/<cloud name>/<resource_type>/upload -X POST --data '<params>'

```

The Upload API supports multiple authentication methods:

* **[Basic Authentication](#using_basic_authentication)**: Authenticate using your API Key and API Secret via HTTP Basic Auth (no signature calculation required)
* **[Signature-based authentication](#using_signature_based_authentication)**: Manually generate a SHA signature with timestamp

> **INFO**: You should never expose your `api_secret` in client-side code, regardless of which authentication method you use.

##### Using Basic Authentication

Basic Authentication is the simplest way to authenticate Upload API requests from your backend. You provide your API Key and API Secret, and Cloudinary handles the authentication without requiring signature calculation.

**To make an authenticated REST API upload request with Basic Authentication:**

1. **Add your credentials**: Include your API Key and API Secret either in the URL or in an Authorization header.

2. **Add the file parameter**: Specify the file to upload. This can be:
    * The actual data (byte array buffer)
    * The Data URI (Base64 encoded)
    * A remote FTP, HTTP or HTTPS URL of an existing file
    * A private storage bucket (S3 or Google Storage) URL of an allowlisted bucket
    
    For more details, see [File source options](upload_parameters#required_file_parameter).

3. **Optionally, add customization parameters**: Include any of the many optional upload parameters available for [customizing your upload](upload_parameters), such as:
    * Naming parameters
    * Tags and metadata (manually specified or automatically generated)
    * Incoming transformations
    * AI-based analysis options
    
    See the [optional upload parameters](image_upload_api_reference#upload_optional_parameters) reference for the full list. 
    
    > **TIP**: Instead of passing optional parameters directly in the upload call, you can define them in a signed [upload preset](upload_presets) and then pass that preset in your upload call.

**Example with Basic Authentication:**

```curl
curl https://<API_KEY>:<API_SECRET>@api.cloudinary.com/v1_1/<CLOUD_NAME>/image/upload \
  -X POST \
  -F "file=sample.jpg" \
  -F "public_id=my_sample" \
  -F "tags=example,basic_auth"
```

Or using the Authorization header:

```curl
curl https://api.cloudinary.com/v1_1/<CLOUD_NAME>/image/upload \
  -X POST \
  -u "<API_KEY>:<API_SECRET>" \
  -F "file=sample.jpg" \
  -F "public_id=my_sample"
```

##### Using signature-based authentication

You can also authenticate using signature-based authentication, which requires [manually generating the signature](authentication_signatures). See the [Client-side uploading](client_side_uploading) documentation for an example [sample app to upload multiple files](client_side_uploading#sample_app_upload_multiple_files_using_a_form_signed) from the client-side while using a backend component to generate the signature.

**To make an authenticated REST API upload request with signature-based authentication:**

1. **Add the file parameter**: Specify the file to upload (see options above).

2. **Add the api_key parameter**: Include the unique API Key of your Cloudinary product environment.

3. **Add the timestamp parameter**: Specify Unix time in seconds of the current time (e.g., 1315060076).

4. **Add the signature parameter**: [Generate a signature](authentication_signatures) of all request parameters including the 'timestamp' parameter and any optional parameters added, but excluding the 'api_key', 'resource_type', 'cloud_name' and 'file' parameters, based on your product environment's API secret. The signature is valid for 1 hour. When no optional upload parameters are part of the signed payload, the string to sign is only the `timestamp` parameter pair. 

5. **Optionally, add customization parameters**: Include any of the optional upload parameters (see above).

**Example with signature-based authentication:**

```curl
curl https://api.cloudinary.com/v1_1/demo/image/upload \
  -X POST \
  --data 'file=sample.jpg&timestamp=173719931&api_key=436464676&signature=a781d61f86a6f818af'
```

### Unauthenticated requests

Unauthenticated upload requests enable you to upload assets without the need to generate an authentication signature on your backend. However, for security reasons, only a small set of upload parameters can be passed directly in an unsigned upload call (see note below). Instead, most unsigned upload options are set via the [unsigned upload preset](upload_presets) that's passed in your unsigned upload call. 

Unsigned uploads require an **unsigned upload preset** (`upload_preset`) and can be triggered from any client that knows the preset name. Treat the preset name as sensitive. If you suspect the preset name was exposed:

* Create a new **unsigned upload preset** with a different name and update your clients to use it. See the Admin API: Create / Update / Delete upload presets.
* Delete any unauthorized assets that may have been uploaded (e.g., by tag or folder).
* Consider switching to **authenticated (signed) uploads** for stronger protection, especially in production.

An **upload preset** defines the upload options to apply to all assets that you upload with that preset specified. You can create multiple upload presets for different use cases. For more information on upload presets, see the [upload preset](upload_presets) guide.

#### Perform an unsigned upload with the SDKs

**To perform an unsigned upload with the SDKs:**

1. **Ensure your SDK is configured with your cloud name**. For details, see the relevant [backend SDK](backend_sdks) guide.
2. **Call the unsigned_upload method**: Use your SDK's `unsigned_upload` method with your file.
3. **Set the upload_preset parameter**: Specify the name of your unsigned upload preset.

For example, to upload the `sample.jpg` file with the `unsigned_1` upload preset using an SDK:

```multi
|ruby
Cloudinary::Uploader.unsigned_upload("sample.jpg", "unsigned_1")

|php_2
$cloudinary->uploadApi()->unsignedUpload("sample.jpg", "unsigned_1");

|python
cloudinary.uploader.unsigned_upload("sample.jpg", "unsigned_1")

|nodejs
cloudinary.v2.uploader
.unsigned_upload("sample.jpg", "unsigned_1")
.then(result=>console.log(result)); 
                           
|java
cloudinary.uploader().unsignedUpload("sample.jpg", "unsigned_1");

|csharp
var uploadParams = new ImageUploadParams(){
  File = new FileDescription(@"sample.jpg"),
  Unsigned = true,
  UploadPreset = "unsigned_1"};
var uploadResult = cloudinary.Upload(uploadParams);

|android
MediaManager.get().upload("sample.jpg")
  .unsigned("unsigned_1").dispatch();

|go
resp, err := cld.Upload.UnsignedUpload(ctx, "sample.jpg", "unsigned_1", uploader.UploadParams{
	Unsigned: api.Bool(true)})

|swift
let request = cloudinary.createUploader().upload(
  url: "sample.jpg", uploadPreset: "unsigned_1")

|cli
cld uploader unsigned_upload "sample.jpg" "unsigned_1"
```

#### Perform an unauthenticated REST API upload request

To make an unauthenticated upload request, include the following required parameters:

1. **Add the file parameter**: Specify the file to upload. This can be:
    * The actual data (byte array buffer)
    * The Data URI (Base64 encoded)
    * A remote FTP, HTTP or HTTPS URL of an existing file
    * A private storage bucket (S3 or Google Storage) URL of an allowlisted bucket
    
    For more details, see [File source options](upload_parameters#required_file_parameter).

2. **Add the upload_preset parameter**: Specify the name of an unsigned [upload preset](upload_presets) that you defined for unsigned uploading.

For example: 

```multi
|curl
curl https://api.cloudinary.com/v1_1/demo/image/upload -X POST --data 'file=sample.jpg&upload_preset=unsigned_1'  
```

[Try out unsigned uploads in a sample app](client_side_uploading#sample_app_upload_multiple_files_using_a_form_unsigned)

> **NOTE**:
>
> For security reasons, only [this restricted set](image_upload_api_reference#unsigned_upload_parameters) of parameters can be used in an **unsigned** upload request. All other parameters you want to apply must be defined in the upload preset. For more information, see [Unsigned upload parameters](image_upload_api_reference#unsigned_upload_parameters).
> If a supported parameter is included both in the unsigned upload call and in the unsigned upload preset, the upload preset value usually takes precedence, but there are some exceptions. For details, see [Upload preset precedence](upload_presets#upload_preset_precedence).

### Chunked asset upload

To support the upload of large files, the Cloudinary SDKs include a method which offers a degree of tolerance for network issues. The `upload_large` method uploads a large file to the cloud in chunks, and is required for any files that are larger than 100 MB. This is often relevant for video files, as they tend to have larger files sizes.

> **TIP**: If you can't or don't want to use the SDKs, you can perform [manual chunked uploads using the REST API](#manual_chunked_upload_rest). See also the [Client-side uploading](client_side_uploading) documentation for an example [sample app to upload large files in chunks](client_side_uploading#sample_app_chunked_asset_upload_from_the_client_side) from the client-side.

#### Upload a large file in chunks using an SDK

**To upload a large file using the SDK 'upload_large' method:**

1. **Call the upload_large method**: Use your SDK's `upload_large` method (or equivalent) with your file.

2. **Specify the resource_type parameter**: By default, backend SDKs set the `resource_type` to `image`. Specify the `resource_type` parameter to match your file type. For example, set `resource_type` to `video` for video files or `auto` if you don't know in advance what type to expect. For more details about the `resource_type` option, see [Asset types](upload_parameters#asset_types).

3. **For files larger than 20 GB, set async to true**: Add the `async` parameter set to `true` to upload the file asynchronously.

4. **Optionally, customize the chunk_size**: The default chunk size is 20 MB, but you can set it as low as 5 MB using the `chunk_size` parameter.

For example, uploading a large video file named `my_large_video.mp4`:

```multi
|ruby 
Cloudinary::Uploader.upload_large("my_large_video.mp4", 
    resource_type: "video")

|php_2
// No uploadLarge method. The upload method automatically applies chunked uploading for large files.
$cloudinary->uploadApi()->upload("my_large_video.mp4",
  ["resource_type" => "video"]);     

|python
cloudinary.uploader.upload_large("my_large_video.mp4", 
  resource_type = "video")

|nodejs
cloudinary.v2.uploader
  .upload_large("my_large_video.mp4", { resource_type: "video" })
  .then(result => console.log(result))
  .catch(error => console.error(error));

|java
cloudinary.uploader().uploadLarge("my_large_video.mp4",
  ObjectUtils.asMap("resource_type", "video"));

|csharp
var uploadParams = new VideoUploadParams(){ // This class sets the resource type to Video
  File = new FileDescription(@"my_large_video.mp4")};
var uploadResult = cloudinary.UploadLarge(uploadParams);

|go
// Large files are automatically chunked using the default chunk size.
resp, err := cld.Upload.Upload(ctx, "my_large_video.mp4", uploader.UploadParams{
		ResourceType: "video"}) 

|android
MediaManager.get().upload("my_large_video.mp4")
  .option("resource_type", "video").dispatch();

|swift
let params = CLDUploadRequestParams()
  .setResourseType("video")
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUploadLarge(
  url: "my_large_video.mp4", params: params)

|cli
cld uploader upload_large "my_large_video.mp4" resource_type="video"
```
  
By default, the chunk size is set to 20 MB but can be set to as low as 5 MB by using the `chunk_size` parameter. For example, uploading a large video file named `my_large_video.mp4` and setting chunk size to 6 MB:

```multi
|ruby  
Cloudinary::Uploader.upload_large("my_large_video.mp4",
  resource_type: "video", 
  chunk_size: 6_000_000)

|php_2
// No distinct uploadLarge method. The upload method automatically applies chunked uploading for large files.
$cloudinary->uploadApi()->upload("my_large_video.mp4", [
    "resource_type" => "video", 
    "chunk_size" => 6000000]);

|python
cloudinary.uploader.upload_large("my_large_video.mp4", 
  resource_type = "video", 
  chunk_size = 6000000)

|nodejs
cloudinary.v2.uploader
  .upload_large("my_large_video.mp4", { resource_type: "video", chunk_size: 6000000 })
  .then(result => console.log(result))
  .catch(error => console.error(error));

|java
cloudinary.uploader().uploadLarge("my_large_video.mp4",
  ObjectUtils.asMap(
    "resource_type", "video", 
    "chunk_size", 6000000));

|csharp
var uploadParams = new ImageUploadParams(){ // This class sets the resource type to Video
  File = new FileDescription(@"my_large_video.mp4")};
var uploadResult = cloudinary.UploadLarge(uploadParams, 6000000);

|go
var largeUploader, _ = uploader.New() 
largeUploader.Config.API.ChunkSize = 6000000

resp, err := cld.Upload.Upload(ctx, "my_large_video.mp4", uploader.UploadParams{
		ResourceType: "video"}) 

|android
MediaManager.get().getCloudinary().uploader().uploadLarge("my_large_video.mp4", options, 6000000);

|swift
let params = CLDUploadRequestParams()
  .setResourceType("video")
var mySig = MyFunction(params)  // your own function that returns a signature generated on your backend
params.setSignature(CLDSignature(signature: mySig.signature, timestamp: mySig.timestamp))
let request = cloudinary.createUploader().signedUploadLarge(
  url: "my_large_video.mp4", params: params, chunkSize: 6000000)

|cli
cld uploader upload_large "my_large_video.mp4" resource_type="video" chunk_size=6000000
```

> **NOTES**:
>
> * There are multiple responses to a chunked upload: one after each chunk that only includes basic information plus the `done : false` parameter, and a full upload response that's returned after the final chunk is uploaded with `done: true` included in the response. 

> * The [Node.js SDK](node_image_and_video_upload#node_js_upload_methods) has several different methods for uploading files, including some that take advantage of Node.js's **stream** functionality.

> * If you have issues with large file uploads, see [troubleshooting large file upload failures](#troubleshooting_large_file_upload_failures).

#### Manual chunked upload (REST)

While we recommend using a Cloudinary SDK for chunked uploads, you can also perform chunked uploads directly against the REST API. When uploading in multiple parts, make sure to:

* Include an `X-Unique-Upload-Id` header with a unique value for the upload, and use the same value for every chunk of that file.
* Include a `Content-Range` header with the location of the chunk in the overall file:
bytes `<start>-<end>/<total>` (for example, bytes `0-5999999/22744222`).
  * If the total size is unknown, set  to -1 for all but the last chunk.
* Use chunk sizes greater than 5 MB for all chunks except the last one.
* Send each chunk as a POST to the Upload API endpoint with your usual upload parameters. For example 

##### Example 1: cURL

**Chunk 1** (bytes `0-5,999,999` of a `22,744,222`-byte file)

```curl
curl -X POST "https://api.cloudinary.com/v1_1/<cloud_name>/upload" \
  -H "X-Unique-Upload-Id: <uuid-for-this-upload>" \\
  -H "Content-Range: bytes 0-5999999/22744222" \
  -F file=@chunk-0 \
  -F api_key=<api_key> \
  -F timestamp=<unix_timestamp> \
  -F signature=<signature>
```

**Chunk 2** (bytes `6,000,000-11,999,999` of a `22,744,222`-byte file)

```curl 
curl -X POST "https://api.cloudinary.com/v1_1/<cloud_name>/upload" \
  -H "X-Unique-Upload-Id: <uuid-for-this-upload>" \
  -H "Content-Range: bytes 6000000-11999999/22744222" \
  -F file=@chunk-1 \
  -F api_key=<api_key> \
  -F timestamp=<unix_timestamp> \
  -F signature=<signature>
```

…repeat for subsequent chunks…

**Final** chunk (include the actual total)

```curl
curl -X POST "https://api.cloudinary.com/v1_1/<cloud_name>/upload" \
  -H "X-Unique-Upload-Id: <uuid-for-this-upload>" \
  -H "Content-Range: bytes 18000000-22744221/22744222" \
  -F file=@chunk-last \
  -F api_key=<api_key> \
  -F timestamp=<unix_timestamp> \
  -F signature=<signature>
```

**Behavior**: You’ll receive an intermediate response after each chunk (with done: false), and a final, full upload response after the last chunk (with done: true). See the SDK examples for additional patterns such as upload_chunked, upload_large, and controlling the chunk_size parameter.

##### Example 2: JavaScript fetch

```javascript
const CHUNK_SIZE = 6 * 1024 * 1024; // >= 5 MB
const uploadId = String(Date.now());

async function uploadInChunks(file) {
  const url = `https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/upload`;
  let start = 0;
  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size) - 1;
    const blob = file.slice(start, end + 1);
    const form = new FormData();
    form.append('file', blob);
    // include any other required params (e.g., upload_preset or signature params)
    const headers = {
      'X-Unique-Upload-Id': uploadId,
      'Content-Range': `bytes ${start}-${end}/${file.size}`
    };
    await fetch(url, { method: 'POST', body: form, headers });
    start = end + 1;
  }
}
```

> **TIP**: For a complete working example, see the [chunked asset upload sample app](client_side_uploading#sample_app_chunked_asset_upload_from_the_client_side) in the Client-side uploading documentation.

#### Troubleshooting large file upload failures

If a large upload fails in the Media Library or via the Upload API, check the following:

* **Upload size limits**: Maximum total upload size (regardless of how its chunked) depends on your plan and account configuration.  You can check your current [usage limits](programmable_media_asset_usage_data#usage_limits) in your Console Account Settings. For details on upload limits per plan, see [Cloudinary pricing](https://cloudinary.com/pricing/compare-plans).
* **Chunked uploads for files larger than 100 MB**: Files larger than 100 MB must be uploaded in chunks when uploading via the API. The Media Library and Upload Widget handle chunked uploading automatically.
* **Network stability**: Large uploads are more sensitive to timeouts and interrupted connections. Retry the upload using a stable, high-bandwidth connection.
* **Error responses and logs**: Review the error returned in the Media Library or in the API response to identify whether the failure is related to file size limits, account limits, or an interrupted upload.
* **Rate limits and storage quotas**: Uploads can also fail if you reach a relevant account quota or API rate limit. See [Account management](account_management#rate_limits) and [Programmable Media asset usage data](programmable_media_asset_usage_data#usage_limits).  If you're unexpectedly reaching your account's limits when working with large files, you can [contact support](https://support.cloudinary.com/hc/en-us/requests/new).

## Upload response

A successful upload API call returns a response that includes the HTTP and HTTPS URLs for accessing the uploaded file, as well as additional information regarding the uploaded asset. Among these are the assigned public ID and current version of the asset (used in the [Media Library](https://console.cloudinary.com/console/media_library/search), Admin API, and for building transformation and delivery URLs), the asset's dimensions, the file format and a signature for verifying the response. Depending on the optional parameters passed, the response might also include valuable analysis data such as detected faces, prominent colors, exif and other embedded metadata, quality/accessibility and other sophisticated media analysis data.

The exact keys returned in the response may vary depending on the parameters passed in your upload call. For details on these parameters and the response fields they influence, see the [Upload API parameters table](image_upload_api_reference#upload_optional_parameters).
> **INFO**: Cloudinary may add more fields to API responses and notifications in the future, so please ensure that your response parsing remains forward compatible and won't break as a result of unknown fields.

The following is an example of the JSON response returned:

```json
{
  "asset_id": "3515c6000a548515f1134043f9785c2f",
  "public_id": "gotjephlnz2jgiu20zni",
  "version": 1719307544,
  "version_id": "7d2cc533bee9ff39f7da7414b61fce7e",
  "signature": "d0b1009e3271a942836c25756ce3e04d205bf754",
  "width": 1920,
  "height": 1441,
  "format": "jpg",
  "resource_type": "image",
  "created_at": "2024-06-25T09:25:44Z",
  "tags": [],
  "pages": 1,
  "bytes": 896838,
  "type": "upload",
  "etag": "2a2df1d2d2c3b675521e866599273083",
  "placeholder": false,
  "url": "http://res.cloudinary.com/cld-docs/image/upload/v1719307544/gotjephlnz2jgiu20zni.jpg",
  "secure_url": "https://res.cloudinary.com/cld-docs/image/upload/v1719307544/gotjephlnz2jgiu20zni.jpg",
  "asset_folder": "",
  "display_name": "gotjephlnz2jgiu20zni",
  "original_filename": "sample",
  "api_key": "614335564976464"
}
```

> **NOTE**: Although the URLs returned in the response are given with the [version number](image_transformations#asset_versions), including the version in the delivery URL is optional.

### Error handling

Once the POST request is received and processed by Cloudinary, the Upload API returns the status of requests using one of the following HTTP status codes:

* 200 - OK. Successful.
* 400 - Bad request. Invalid request parameters.
* 401 - Authorization required.
* 403 - Not allowed.
* 404 - Not found.
* 420 - Rate limited.
* 500 - Internal error. Contact support. 

In the case of wrong usage of the API or an error, Cloudinary's response is returned with a non-OK (not 200) HTTP Status code and a body with the following JSON format:

```javascript
{ error: { message: "<< Error explanation here >>" } }
```

### Parallel uploads and rate limiting

Cloudinary’s Upload API accepts one file per request, but you can upload many files in parallel for faster migrations. Begin with a modest concurrency (for example, ~10 simultaneous upload requests) and increase gradually. If you hit account limits and receive HTTP 420 (Rate limited), reduce concurrency and retry the failed requests with exponential backoff.

```nodejs
async function uploadAll(files, limit = 10) {
  const queue = [...files];
  const workers = Array.from({ length: limit }, async function worker() {
    while (queue.length) {
      const file = queue.shift();
      try { await cloudinary.uploader.upload(file); }
      catch (e) {
        if (e.http_code === 420) { /* backoff, requeue */ queue.push(file); await new Promise(r=>setTimeout(r, 1000)); }
        else throw e;
      }
    }
  });
  await Promise.all(workers);
}
```

Adjust the concurrency limit to your account and workload; if rate-limited, slow down and retry.

## Upload considerations

There are various ways to upload your resources to your Cloudinary account. Cloudinary supports making both [authenticated requests](#authenticated_requests) that require a signature generated on your backend, and [unauthenticated requests](#unauthenticated_requests) with a restricted set of supported parameters. 

The following table summarizes the main options to upload assets and some considerations to take into account for each of them:

{table:class=no-borders overview wide-lastcol-40} Option | Description | Considerations
---|---|---
[Cloudinary backend SDKs](#authenticated_requests)  | The Cloudinary backend SDKs wrap the upload API, including taking care of the upload itself, the signature authentication and the response verification. |  ✅ Significantly simplifies the upload code compared to directly calling the REST API ✅ Automatically generates an authentication signature and validates the response   ✅ Enables you to code in your chosen language   ✅  Provides built-in support for uploading large files with chunked uploading
[Upload widget](upload_widget)  | An interactive, feature-rich interface you can embed in your website or application to allow your users to upload assets directly to Cloudinary. | ✅  No need to develop an in-house interactive file upload solution  ✅  Simple to integrate ✅  Can be used for unauthenticated client-side uploads  ✅  Enables uploading directly from a variety of social media & stock photo accounts
['upload' endpoint of the REST API](#basic_uploading)  | The `upload` endpoint of the Cloudinary API supports making both [authenticated requests](#authenticated_requests) that require a signature be generated on your backend, and [unauthenticated requests](#unauthenticated_requests) with a restricted set of supported parameters. |  ✅  Can be used for unauthenticated client-side requests  ✅ Useful when coding in a language not covered by Cloudinary's SDKs💡 Requires manually coding the upload and validating the response💡 Requires a function on your backend to generate the signature for authenticated calls
[Direct upload from a browser](client_side_uploading#direct_uploading_from_the_browser_via_a_backend_sdk)  | The Cloudinary Backend SDKs can also be used to automatically add a file input field to your form that uploads files directly to Cloudinary,  bypassing your own servers.  |   ✅  Uploads directly to your account, bypassing your own servers 💡 Requires additional setup and configuration 💡 Requires the Cloudinary jQuery plugin 
[The Cloudinary CLI](cloudinary_cli)   | The Cloudinary CLI (Command Line Interface) enables you to interact with Cloudinary through the command line and provides additional features and helper commands. |   ✅ Simple to use ✅  Useful for quickly uploading assets without setting up a formal coding environment ✅  Useful for experimenting with upload parameters and behavior ✅ Upload-specific helper functions (e.g., sync) not directly provided via the other upload options
[Lazy migration](migration#lazy_migration_with_auto_upload) | Cloudinary's lazy migration with the auto-upload feature enables you to migrate files on demand from a remote location, where each asset is automatically uploaded to Cloudinary the first time the delivery URL for that asset is requested. |  ✅  Simple to implement  ✅ Only upload the assets you really need 💡 Not suitable if there's a deadline when the remote content will be unavailable
[Media Library](https://console.cloudinary.com/console/media_library/search)  | The Media Library in the Cloudinary Console lets you upload assets to your account using drag and drop or the built-in Upload Widget. |  ✅ Simple to use  ✅  Useful for quickly uploading assets without dealing with code ✅  Useful for experimenting with upload preset behavior 💡 Less suitable as a primary means of uploading assets compared to programmatic solutions
[Integrations](integrations)  | Cloudinary has developed built-in integrations with many leading eCommerce, CMS and PIM platforms. |  ✅  Enables platform users to upload to Cloudinary from directly within the platform UI 💡 Requires initial set up and configuration by a platform administrator 💡 Less suitable as a primary means of uploading assets compared to programmatic solutions
[Media Library widget](media_library_widget)  | The Media Library widget enables embedding all the Cloudinary Media Library UI capabilities, including upload, into another application's UI. | ✅ Useful for implementing your own Cloudinary integration 💡 Less suitable as a primary means of uploading assets at scale compared to programmatic solutions

> **TIP**:
>
> :title=Tips:

> * [MediaFlows](https://console.cloudinary.com/mediaflows), Cloudinary’s drag-and-drop workflow builder for image and video, offers the option to automate image upload with a low-code implementation. See MediaFlow’s documentation on media upload [here](mediaflows_block_reference#upload_media). 

> * Usage limits for uploading, transforming and delivering files depend on your Cloudinary [plan](https://cloudinary.com/pricing). For details, check the **Account** tab in your Cloudinary Console **Settings**.

### Avoiding duplicate uploads

In many cases, you don’t need to explicitly check whether an asset exists before uploading it. Cloudinary provides upload-time mechanisms that can prevent duplicate uploads without requiring a separate existence check.

However, if your upload flow requires verifying whether an asset already exists, the following approaches are available, each with different tradeoffs.

If you instead want to intentionally replace an existing asset on upload, see [Replacing existing assets](upload_parameters#replacing_existing_assets).

#### Recommended: prevent duplicates during upload

When uploading assets with a deterministic `public_id`, you can prevent re-uploading existing assets by setting the parameter `overwrite` to `false`. If an asset with the same `public_id` already exists, the upload is skipped and the response includes:

```json
{
  "existing": true
}
```

This approach avoids additional API calls and is the safest and most scalable way to prevent duplicate uploads. If you still want to check the existence of an asset, here are several other options:

#### Option 1: Check existence via the delivery URL

You can issue an HTTP HEAD request to the asset’s delivery URL, for example:

```curl
curl -I https://res.cloudinary.com/demo/image/upload/sample.jpg
```

* Returns 200 if the asset exists
* Returns 404 if the asset doesn't exist

> **NOTES**:
>
> * This method is fast and not rate-limited

> * Results may be affected by CDN caching, especially if the asset was recently deleted

> * Response headers count toward your bandwidth quota

> * A HEAD request doesn't consume transformation quotas unless it triggers an auto-upload or fetch

> * This approach is suitable when performance is critical and eventual consistency is acceptable.

#### Option 2: Use the Admin API for an authoritative check

To definitively verify whether an asset exists, use the Admin API to retrieve the resource by its public ID.

```multi
|curl
curl https://<API_KEY>:<API_SECRET>@api.cloudinary.com/v1_1/<cloud_name>/resources/image/upload/sample
       
|ruby
result = Cloudinary::Api
.resource('sample')

|php_2
$result = $api
->asset("sample");

|python
result = cloudinary\
.api.resource("sample")

|nodejs
cloudinary.v2.api
.resource('sample')
.then(result=>console.log(result)); 

|java
result = api.resource("sample", ObjectUtils.emptyMap());

|csharp
result = cloudinary.GetResource("sample");

|go
resp, err := cld.Admin.Asset(ctx, admin.AssetParams{PublicID: "sample"})

|cli
cld admin resource sample
```

If the asset exists, the API returns the [resource and its data](admin_api#get_the_details_of_a_single_resource_sample_response). If the asset doesn't exist, the API returns a 404 error.

> **NOTES**:
>
> * Results aren't affected by CDN caching

> * Subject to Admin API rate limits

> * If a deleted asset still has a backup available, the response includes a `placeholder: true` field.

#### Option 3: Using the Upload API explicit method (advanced)

Some upload pipelines use the Upload API’s `explicit()` method to check whether an asset exists before performing upload-related actions.

If the asset exists, the call returns the asset data.
If it doesn't exist, the call returns an error.

```multi
|ruby  
result = Cloudinary::Uploader
.explicit("sample", 
  type: "upload")
 
|php_2
$result = $cloudinary->uploadApi()
->explicit("sample", [
    "type" => "upload"]);
 
|python
result = cloudinary.uploader\
.explicit("sample", 
  type = "upload")


|nodejs
cloudinary.v2.uploader
.explicit("sample", 
  { type: "upload"})
.then(result=>console.log(result)); 

  
|java
result = cloudinary.uploader()
.explicit("sample", 
  ObjectUtils.asMap(
    "type", "upload"));

|csharp
var explicitParams = new ExplicitParams("sample"){
  Type = "upload"};
var explicitResult = cloudinary.Explicit(explicitParams);

|go
resp, err := cld.Upload.Explicit(ctx, uploader.ExplicitParams{
    PublicID: "sample", 
    Type: "upload"})

|dart
cloudinary.uploader().explicit(ExplicitParams("sample",
    params: UploadParams(
        type: "upload")));

|swift
let result = cloudinary.createManagementApi().explicit(publicId)

|curl
curl https://api.cloudinary.com/v1_1/cld-docs/image/explicit -X POST --data 'type=upload&public_id=sample&timestamp=173719931&api_key=614335564976464&signature=a788d68f86a6f868af' 

|cli
cld uploader explicit "sample" type="upload"
```

> **NOTES**:
>
> * The Explicit method is primarily intended for applying actions to existing assets (such as eager transformations)

> * This approach may be useful when your upload flow already relies on the Upload API and you require a definitive, non-cached result.

## Clara Denari mini-mystery game

  
    
    
      
      
        🔍 The Case of the Sapphire Earrings
        A Clara Denari Mini Mystery
      
    
    
    
    
      
        
        
          
            
            
              Hey! I need your help. 🤔 I found sapphire earrings in my backyard, but my neighbor Mrs. Patterson claims they're hers: a family heirloom from her grandmother.
              She has an old photo to prove it, but it's so blurry I can't tell if the earrings match. Can you help me upload it to Cloudinary with AI restoration?
              Let's see if Mrs. Patterson's story checks out!
            
          
        
        
        
        
          🔍 Evidence
          
            
              
                
              
              The earrings I found
            
            
              
                
              
              Mrs. Patterson's blurry photo
            
          
        
        
        
        
          
            🎮 Upload the Photo
          
        
      
    

    
        
          
            
            
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  Perfect! Let's use the upload function to both upload and restore the photo using Cloudinary's AI. ✨
                  First, choose which SDK you want to use:
                  
                    Node.js
                    Python
                    Ruby
                    PHP
                    Java
                    Go
                  
                
              
              
              
              
                
                  
                  
                  
                
              
              
              
              
                
                
                  Cool, you chose Node.js! Use these parameters and values to edit the starter code in the editor below:
                  
                    • Upload file:
                    <code id="clara-mystery__file-param">file_name → <code>grandma_photo_1960.png
                    
                    • Restore photo:
                    param1: <code id="clara-mystery__param1-name">transformation
                    value1: <code id="clara-mystery__value1-name">e_gen_restore
                    
                    • Name uploaded photo:
                    param2: <code id="clara-mystery__param2-name">public_id
                    value2: <code>earrings_restored
                    
                    • Store in folder:
                    param3: <code id="clara-mystery__param3-name">asset_folder
                    value3: <code>evidence
                  
                
              
              
              
              
            
            
            
            
              📸 Photo to Restore
              
                
                  
                    
                  
                  grandma_photo_1960.png
                
              
            
            
            
            
              

  
    
      Node.js
      Python
      Ruby
      PHP
      Java
      Go
    
    💡 Need a hint?
  
  
  
    cloudinary.v2.uploader.upload('file_name', {
  param1: 'value1',
  param2: 'value2',
  param3: 'value3'
})
  
  
  
    cloudinary.uploader.upload('file_name',
  param1='value1',
  param2='value2',
  param3='value3')
  
  
  
    Cloudinary::Uploader.upload('file_name',
  param1: 'value1',
  param2: 'value2',
  param3: 'value3')
  
  
  
    (new UploadApi())->upload('file_name', [
  'param1' => 'value1',
  'param2' => 'value2',
  'param3' => 'value3'
]);
  
  
  
    cloudinary.uploader().upload("file_name",
  ObjectUtils.asMap(
    "param1", "value1",
    "param2", "value2",
    "param3", "value3"
  ));
  
  
  
    <textarea class="clara-mystery__input" rows="7" disabled>cld.Upload.Upload(ctx, "FileName", uploader.UploadParams{
  Param1: "value1",
  Param2: "value2",
  Param3: "value3"
})
  

              
              
              
                ✨ Upload & Restore!
                Reset Code
              
            
          
        
        
        
        
        
          
            
            
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  Amazing work! 🎉 The upload was successful!
                  You applied the AI restore transformation first, and then uploaded the transformed, restored version to Cloudinary.
                  
                
              
              
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  Now I need you to find the secure_url in the response. That's the URL you can use to access the restored image.
                  Copy that URL and paste it below. Let's see if the AI restoration worked! 🔍
                  
                
              
              
              
              
            
            
            
            
              📋 Upload Response
              
                <pre class="clara-mystery__code" style="margin: 0;"><code>{
  "asset_id": "1c3547643785ba27005340620d46d6ba",
  "public_id": "earrings_restored",
  "version": 1763564796,
  "width": 1200,
  "height": 1200,
  "format": "jpg",
  "resource_type": "image",
  "created_at": "2025-11-19T15:06:36Z",
  "bytes": 271366,
  "url": "http://res.cloudinary.com/.../earrings_restored.png",
  "secure_url": "https://res.cloudinary.com/demo/image/upload/v1768438613/earrings_restored.png",
  "original_filename": "grandma_photo_1960"
}
              
            
            
            
            
              
                Paste the secure URL here:
              
              
                
                
                
                
                🔓 Show Me the Restored Photo!
              
            
          
        
        
        
        
        
          
            
            
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  Perfect! 🎉 Now drag the slider to see the incredible AI restoration in action!
                
              
              
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  The earrings in the photo do look similar to the ones I found...
                  Do you think the earrings in Mrs. Patterson's restored photo match the earrings I found?
                
              
              
              
              
                Yes
                No
              
              
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  
                
              
              
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  💡 Key Takeaways: You've learned how to:
                  ✓ Enhance blurry, low-quality images with <code>e_gen_restore
                  ✓ Customize your upload by adding transformations and other parameters.
                  
                  🚀 Next Steps: Try it in your environment!
                  Click Back for the game example, or explore more upload customization options:
                  
                  
                    📤 Customize Your Uploads
                  
                
              
              
              
              
                
                
                  
                  
                  
                
              
              
              
              
                
                
                  When you're done with your code, help me settle this mystery! Let's run a color analysis in my lab to see if these earrings really match. 🔬
                
              
              
              
              
              
            
            
            
            
              ✨ Restoration Complete!
              
                Drag the slider to see the before and after!
              
              
              
              
              
                
                
              
              
              
              
                ← After (AI Restored!)
                Before (Blurry) →
              
              
              
                
                  
                
                The earrings I found
                
                  Note: This mini‑mystery uses a simulated upload. In real apps, authenticate uploads with your Cloudinary API key and secret on a secure server, and never expose those credentials in client‑side code.
                
              
            
            
          
        
        
        
        
        
          ← Back
          Next →
          🔄 Play Again
        
        
      
    
  

  
    📖 Cloudinary Upload Reference
    ✕
  
  
    
    
  

  
    
      💡 Hint
      ✕
    
    
      Remember the upload structure:
      
        // Each SDK has an uploader with an upload method:
        uploader.upload(filename, {parameters})
      
      
      Quick tips:
      
        The filename comes first, then the parameters object
        Use the exact filename: <code>grandma_photo_1960.png
        Watch your syntax! Each language has slightly different formats:
          
            Node.js/Python: <code>param: 'value' or <code>param='value'
            Ruby: <code>param: 'value'
            PHP: <code>'param' => 'value'
            Java: <code>"param", "value" (comma-separated pairs)
            Go: <code>Param: "value" (PascalCase)
          
        
        Don't forget commas between parameters!
      
      
      
        Still stuck? Look at the placeholder code in your selected language tab - it shows the basic structure you need.
      
    
  

> **See also**:
>
> * [Upload API Reference](image_upload_api_reference): Provides both REST and SDK syntax, parameter details, and examples for all methods of the Upload API.

> * [Upload Add-ons](cloudinary_add_ons): Many of Cloudinary's add-ons can be activated by adding a parameter in your upload call. These add-ons enable you to take advantage of special deep-learning, AI, and other analytical capabilities offered by Cloudinary as well as other vision and image processing partners. 

> * [Asset management](asset_management): Covers options for managing your uploaded assets programmatically, including various CRUD options, backups and version management, notifications and webhooks, and authentication and signature options.* [User-generated content guide](user_generated_content): Upload is a key component of allowing user-generated content to be displayed on your site. Learn about all the features you can take advantage of when handling user-generated content.
