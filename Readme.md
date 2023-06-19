# Hyperledger Fabric for Oceanography Dataset

This project focuses on creating a Hyperledger Fabric network for managing oceanography dataset. It is developed in collaboration with SOCIB (Societat d'Oceanografia de les Illes Balears).

## Installation and Setup:

### 1. Clone the Dataset
Clone the oceanography dataset repository to your local machine.

```bash
git clone <repository_url>
```

### 2. Install Prerequisites
Make sure you have the following prerequisites installed:
- Golang
- Docker
- JavaScript
- TypeScript

### 3. Set Up the Network
Navigate to the 'test-network' directory.

```bash
cd test-network
```

Run the following command to set up the Hyperledger Fabric network and deploy the chaincode:
```bash
./network.sh up createChannel -c mychannel ; ./network.sh deployCC -c mychannel -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go
```

Note: You can customize the channel name by replacing 'mychannel' with your preferred channel name.

### 4. Run the REST API
Navigate to the 'rest-api-typescript' directory.

```bash
cd ../rest-api-typescript
```
Run the following command to start the TypeScript REST API server:
```bash
./runTypescript.sh -c mychannel
```
### 5. Perform CRUD Operations
You can now start performing CRUD operations on the REST API. To access the API, open your web browser and go to __localhost:3000__ or use your preferred API client. If you are using Postman, you can import the Postman collection from the repository: __SOCIB collection.postman_collection.json__. Don't forget to add the API key for CRUD operations in Postman, which was highlighted in green from the previous script.

### Contributing:
Please feel free to contribute to this project by submitting pull requests or creating issues.