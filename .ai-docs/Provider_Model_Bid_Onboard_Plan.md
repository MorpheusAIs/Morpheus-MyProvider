Goal: 
* develop a simple gui or program (maybe nextjs or react) that can eventually become a static s3/cloudfront website, but for now can run locally....to assist with all the onboarding of a new provider...including creating a new model (check if it doesn't exist), adding a bid to a model (existing or new) and also updating or deleting any of those. 
* Basically a gui companion to the provider proxy-router api environment. 
* for the time being, focus on the gui/website functionality and we can worry about hosting and presenting later

Suggestions: 
* should be highly interactive as we may need to do the full thing (add provider, add model and add bid) 
* or just as simple as adding a bid to an existing model hosted by an existing provider 
* can be used for mainnet and testnet
* all direct calls to the API 
* Base API should be a live / running Proxy-Router API (e.g., "http://your-provider.domain.io:8082")
* will need to ask or have entered the API admin username and password 
* will need to authenticate to the API and get the bearer token for the API calls
* there should be a high amount of question, answering and validation of the blockchain using the GET endpoints to make sure before we POST something that we are accurate.  Things like wallet/provider verification, model_ID, model name, provider endpoint, etc...
* Intelligently leverage all the existing proxy-router api endpoints to get the data from the blockchain or the proxy-router itself ... you will probably have to parse and conditionally filter the returned data to get the information you need.
* if we think more about htis from a GUI...maybe we have a couple of tabs (provider, model and bid) that can show existing provider(by wallet) owned and active endpoint as a provider, active, owned models and active bids associated with any model on the contract) 
* Nothing should be stored session to session... on each program startup, we can ask for the API endpoint, username and password for the API ... then load the data from the blockchain and the proxy-router into the GUI
* each tab or page should be able to do FULL CRUD operations for those elements 
* Also include ability to manage wallet balances and approvals. 
* We will NOT manage any other features other than Wallet, Provider, Model and Bid
* again, this should be able to run locally and have the same look and feel like @Morpheus-Marketplace-App (which is meant to front-end the API gateway...in our case, we'll be building a provider-focused GUI front end for the proxy-router) ))

Flow: 
1. start program and ask for the base URL of the API (e.g., http://your-provider.domain.io:8082)
2. ask for the API admin username and password
3. authenticate to the API and get the bearer token for the API calls
4. The proxy-routers operating environment will determine if we're on testnet or mainnet (so question doesn't need to be asked).  
7. ask if we are onboarding a provider, model or bid
8. if provider, ask for endpoint and stake and add Provider (POST /blockchain/providers)
1. Get Wallet Address from the API 
2. Check that the wallet is already onboarded as a provider (GET /blockchain/providers)
    * if not, ask for endpoint and stake and add Provider (POST /blockchain/providers)
3. Check that the wallet is already onboarded as a model (GET /blockchain/models)
    * if not, ask for model name, ipfsCID, stake and fee and add Model (POST /blockchain/models)
4. Add Model if not already onboarded    (POST /blockchain/models)
5. Add Bid if not already onboarded    (POST /blockchain/bids)

Assumptions: 
* other endpoints: 
* http://your-provider.domain.io:8082/healthcheck
* http://your-provider.domain.io:8082/swagger/doc.json full swagger documentation


Variables: (need blocks for mainnet and testnet)
arbMOR Contract: 0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86 
Diamond: 0xDE819AaEE474626E3f34Ef0263373357e5a6C71b
base_URL: <base url for the API> 
api_user: <api user>
api_password: <api password>



# PreRequisites and limits: 
## Contract Minimums 
  * "providerMinStake":  "200000000000000000", (0.2 MOR)
  * "modelMinStake":     "100000000000000000", (0.1 MOR)
  * "marketplaceBidFee": "300000000000000000", (0.3 MOR)
  * "bidPricePerSeconMin "10000000000", (0.00000001 MOR)

  Need at least 0.6 MOR just to start ... suggest 1MOR to allow full setup.

## SEND 10 saMOR to Other Wallets: 


# SAMPLES: 
## ONBOARD PROVIDER EXAMPLE (bash commands and then in some cases this shows the output)
### 0. Verify Account Balance: 
```bash 
curl -X 'GET' \
  'http://your-provider.domain.io:8082/blockchain/balance' \
  -H 'accept: application/json'
```

### 1. Approve 10,010 MOR on Diamond (10k for stake and 10 for Operational): 
```bash
curl -X 'POST' \
  'http://your-provider.domain.io:8082/blockchain/approve?spender=0xDE819AaEE474626E3f34Ef0263373357e5a6C71b&amount=10010000000000000000000' \
  -H 'accept: application/json' \
  -d ''
```

### 2. Create Provider: Need PRovider stake Minimum 
```bash 
curl -X 'POST' \
  'http://your-provider.domain.io:8082/blockchain/providers' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "endpoint": "morpheus.titan.io:3333",
  "stake": "200000000000000000"
}'
```
{"provider":{"Address":"0x63da1c6b40cc9d7dcdac9a19f1a818443f452139","Endpoint":"morpheus.titan.io:3333","Stake":"200000000000000000","CreatedAt":"1731954671","IsDeleted":false}}%      

Validate Provider ... then increase stake to 10K 
```bash 
curl -X 'POST' \
  'http://your-provider.domain.io:8082/blockchain/providers' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "endpoint": "morpheus.titan.io:3333",
  "stake": "10000000000000000000000"
}'
```
{"provider":{"Address":"0x63da1c6b40cc9d7dcdac9a19f1a818443f452139","Endpoint":"morpheus.titan.io:3333","Stake":"10000000000000000000000","CreatedAt":"1731954671","IsDeleted":false}}% 

{
  "providers": [
    {
      "Address": "0xb538e4b049ef0476fe320c5f617ce8940de338f8",
      "Endpoint": "ec2-3-12-162-175.us-east-2.compute.amazonaws.com:3333",
      "Stake": "200000000000000000",
      "CreatedAt": "1731906436",
      "IsDeleted": false
    },
    {
      "Address": "0x63da1c6b40cc9d7dcdac9a19f1a818443f452139",
      "Endpoint": "morpheus.titan.io:3333",
      "Stake": "10000 000 000 000 000 000 000",
      "CreatedAt": "1731954671",
      "IsDeleted": false
    }
  ]
}

## ONBOARD MODEL EXAMPLE (bash commands and then in some cases this shows the output)
* Assume we have already onboarded the provider and we are onboarding a model for the provider.
* If we select a model (by name) that is already defined on the blockchain, then we'll grab the model id and create the bid. 
* otherwise, we'll create the model desired ... the unique model id will be generated and returned as it is seeded by the requested id as shown in the example. 

### 3.1 Create ModelID (hermes)
```bash 
curl -X 'POST' \
  'http://your-provider.domain.io:8082/blockchain/models' \
  -H 'authorization: Basic YWRtaW46UXFXQnJpRWZaUDM5ZVpzS3hjc0U2ZWd4aXFpOWFONXM=' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "fee": "300000000000",
  "id": "0x0f2e6f5efbde3d31f620d450aa7b5ccd687c6f06bc95c1e5b4e33fc6b4ae13e9",
  "ipfsID": "0xa3eab0b19d93a55c94ac09c1b4fffb2892658897d148e7b703e84d492a1a45d6",
  "name": "Hermes-2-Theta-Llama-3-8B",
  "stake": "100000000000000000",
  "tags": [
    "LLM", 
    "Titan", 
    "Hermes-2-Theta",
    "Llama-3-8B"
  ]
}'
```
09/17/2025 - Updated model with the instructions above 
Return: 
{"model":{"Id":"0x6df2b9d03d35dabc79a8d12146407c55942675ec235a35f5d431cc28d597511d","IpfsCID":"0xa3eab0b19d93a55c94ac09c1b4fffb2892658897d148e7b703e84d492a1a45d6","Fee":300000000000,"Stake":200000000000000000,"Owner":"0x63da1c6b40cc9d7dcdac9a19f1a818443f452139","Name":"Hermes-2-Theta-Llama-3-8B","Tags":["LLM","Titan","Hermes-2-Theta","Llama-3-8B"],"CreatedAt":1731955454,"IsDeleted":false,"ModelType":"LLM"}}%        

* Grab new ModelID From Blockchain

{
      "Id": "0x6df2b9d03d35dabc79a8d12146407c55942675ec235a35f5d431cc28d597511d",
      "IpfsCID": "0xa3eab0b19d93a55c94ac09c1b4fffb2892658897d148e7b703e84d492a1a45d6",
      "Fee": 300000000000,
      "Stake": 100000000000000000,
      "Owner": "0x63da1c6b40cc9d7dcdac9a19f1a818443f452139",
      "Name": "Hermes-2-Theta-Llama-3-8B",
      "Tags": [
        "Titan",
        "Hermes-2-Theta",
        "Llama-3-8B"
      ],
      "CreatedAt": 1731955454,
      "IsDeleted": false
    },


# CREATE BID EXAMPLE (bash commands and then in some cases this shows the output)
* Assume we have already onboarded the model and we are onboarding a bid for the model.

### 4. Create BidID 
Hermes: 
{
  "modelID": "0x6df2b9d03d35dabc79a8d12146407c55942675ec235a35f5d431cc28d597511d",
  "pricePerSecond": "42000000"
}
```bash
curl -X 'POST' \
  'http://your-provider.domain.io:8082/blockchain/bids' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "modelID": "0x6df2b9d03d35dabc79a8d12146407c55942675ec235a35f5d431cc28d597511d",
  "pricePerSecond": "10000000000"
}'
```
* Return: 

{"bid":{"Id":"0x3e59864a67c982b2fea870e934ea1fbdd47c46de7cae8bb528eec4c2c8fdd2a9","Provider":"0x63da1c6b40cc9d7dcdac9a19f1a818443f452139","ModelAgentId":"0x6df2b9d03d35dabc79a8d12146407c55942675ec235a35f5d431cc28d597511d","PricePerSecond":"10000000000000","Nonce":"0","CreatedAt":"1731956494","DeletedAt":"0"}}% 