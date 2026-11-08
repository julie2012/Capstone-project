<?php
// send_sms.php
header('Content-Type: application/json');

// Tanggapin ang data mula sa JavaScript
$number = $_POST['number'] ?? '';
$message = $_POST['message'] ?? '';

// I-check kung may laman ang pinasa
if(empty($number) || empty($message)) {
    echo json_encode(['error' => 'Walang numero o mensahe na natanggap.']);
    exit;
}

// Ang iyong Semaphore Credentials
$apikey = '94c57cba20b569de57a9580275a1a847';
$sendername = 'SJNHS';

// I-setup ang cURL para direkta sa Semaphore (Ligtas ito sa CORS)
$ch = curl_init();
$parameters = array(
    'apikey' => $apikey,
    'number' => $number,
    'message' => $message,
    'sendername' => $sendername
);

curl_setopt($ch, CURLOPT_URL, 'https://api.semaphore.co/api/v4/messages');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($parameters));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

// I-execute at kunin ang sagot ng Semaphore
$output = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Ibalik ang sagot pabalik sa JavaScript mo
http_response_code($httpcode);
echo $output;
?>