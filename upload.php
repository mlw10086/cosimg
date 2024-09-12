<?php
header('Content-Type: application/json');

define('API_BASE_URL', 'https://video.a2e.com.cn');
define('AUTH_TOKEN', '更换为你的Authorization');

$maxFileSize = 20 * 1024 * 1024; 

function getTemporaryCredentials() {
    $ch = curl_init(API_BASE_URL . '/api/cos/sts');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['type' => 'default']));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . AUTH_TOKEN,
        'Content-Type: application/json',
        'customlocale: zh-CN',
        'webtype: a2e',
        'x-lang: zh-CN'
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

function uploadFileToCOS($file, $credentials) {
    $filename = basename($file['name']);
    $cosPath = 'adam2eve/stable/faceSwap/' . date('Ymd') . '/' . time() . '000.jpeg';
    $url = "https://jumpy-prod-data-1302954538.cos.accelerate.myqcloud.com/{$cosPath}";

    $fileContent = file_get_contents($file['tmp_name']);
    if ($fileContent === false) {
        return false;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $authHeader = buildAuthHeader($credentials, $cosPath);
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: ' . $authHeader,
        'Content-Type: image/jpeg',
        'x-cos-security-token: ' . $credentials['credentials']['sessionToken'],
        'x-cos-storage-class: STANDARD'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode == 200 ? $url : false;
}

function buildAuthHeader($credentials, $cosPath) {
    $secretId = $credentials['credentials']['tmpSecretId'];
    $secretKey = $credentials['credentials']['tmpSecretKey'];
    $startTime = time();
    $endTime = $startTime + 3600;
    $keyTime = "$startTime;$endTime";
    
    $signKey = hash_hmac('sha1', $keyTime, $secretKey);
    $urlParamList = '';
    $httpParameters = '';
    
    $httpString = "put\n/$cosPath\n$urlParamList\n$httpParameters\n";
    $stringToSign = "sha1\n$keyTime\n" . sha1($httpString) . "\n";
    
    $signature = hash_hmac('sha1', $stringToSign, $signKey);
    
    return "q-sign-algorithm=sha1&q-ak=$secretId&q-sign-time=$keyTime&q-key-time=$keyTime&q-header-list=&q-url-param-list=&q-signature=$signature";
}

function recordUploadInfo($faceUrl) {
    $ch = curl_init(API_BASE_URL . '/api/userFaceSwapImage/add');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['face_url' => $faceUrl]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . AUTH_TOKEN,
        'Content-Type: application/json',
        'customlocale: zh-CN',
        'webtype: a2e',
        'x-lang: zh-CN'
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

function uploadFile($file) {
    $credentials = getTemporaryCredentials();
    if (!isset($credentials['data']['credentials'])) {
        return json_encode(['success' => false, 'message' => '获取临时凭证失败']);
    }

    $uploadedUrl = uploadFileToCOS($file, $credentials['data']);
    if (!$uploadedUrl) {
        return json_encode(['success' => false, 'message' => '上传文件到COS失败']);
    }

    $recordResult = recordUploadInfo($uploadedUrl);
    if ($recordResult['code'] !== 0) {
        return json_encode(['success' => false, 'message' => '记录上传信息失败']);
    }

    return json_encode(['success' => true, 'message' => '文件上传成功', 'url' => $uploadedUrl]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    if ($_FILES['file']['size'] > $maxFileSize) {
        echo json_encode(['success' => false, 'message' => '文件大小超过20MB限制']);
        exit;
    }
    
    echo uploadFile($_FILES['file']);
}
