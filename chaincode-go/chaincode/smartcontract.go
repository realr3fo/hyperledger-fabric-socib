package chaincode

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/golang/protobuf/ptypes"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing an Asset
type SmartContract struct {
	contractapi.Contract
}

type SocibHistoryQueryResult struct {
	Record    *SocibHFRadarAsset `json:"record"`
	TxId      string             `json:"txId"`
	Timestamp time.Time          `json:"timestamp"`
	IsDelete  bool               `json:"isDelete"`
}

type SocibHFRadarAsset struct {
	ID    string `json:"ID"`
	Owner string `json:"Owner"`

	// File Atttributes
	FileHash         string `json:"FileHash"`
	FileUniqueID     string `json:"FileUniqueID"`     // Maybe just ID is enough?
	FileCreationTime string `json:"FileCreationTime"` // TimeStamp from the file

	// Metadata
	CommonVariables string `json:"CommonVariables"`
	Longitude       string `json:"Longitude"`
	Latitude        string `json:"Latitude"`
	Time            string `json:"Time"` // ProcessedTimeStamp from the file

	// Series Attributes (for each column in the file, save these)
	Mean              string `json:"Mean"`
	Min               string `json:"Min"`
	Max               string `json:"Max"`
	StandardDeviation string `json:"StandardDeviation"`

	// Context Attributes
	NumberOfSeries  int    `json:"NumberOfSeries"`  // column length
	SoftwareVersion int    `json:"SoftwareVersion"` // 1
	Links           string `json:"Links"`           // if hfradar then the links, otherwise ''
}

// SOCIB ASSETS
func (s *SmartContract) CreateSocibAsset(ctx contractapi.TransactionContextInterface, id, owner, fileHash, fileUniqueID, fileCreationTime string, commonVariables string, longitude, latitude string, time string, mean, min, max, standardDeviation string, numberOfSeries, softwareVersion int, links string) error {
	// Check if the asset already exists
	exists, err := s.SocibAssetExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the asset %s already exists", id)
	}

	// Create the SocibHFRadarAsset instance
	socibAsset := SocibHFRadarAsset{
		ID:                id,
		Owner:             owner,
		FileHash:          fileHash,
		FileUniqueID:      fileUniqueID,
		FileCreationTime:  fileCreationTime,
		CommonVariables:   commonVariables,
		Longitude:         longitude,
		Latitude:          latitude,
		Time:              time,
		Mean:              mean,
		Min:               min,
		Max:               max,
		StandardDeviation: standardDeviation,
		NumberOfSeries:    numberOfSeries,
		SoftwareVersion:   softwareVersion,
		Links:             links,
	}

	// Marshal the SocibHFRadarAsset instance to JSON
	socibAssetJSON, err := json.Marshal(socibAsset)
	if err != nil {
		return err
	}

	// Store the asset in the ledger
	return ctx.GetStub().PutState(id, socibAssetJSON)
}

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) SocibAssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	socibAssetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return socibAssetJSON != nil, nil
}

// ReadAsset returns the asset stored in the world state with given id.
func (s *SmartContract) ReadSocibAsset(ctx contractapi.TransactionContextInterface, id string) (*SocibHFRadarAsset, error) {
	socibAssetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if socibAssetJSON == nil {
		return nil, fmt.Errorf("the asset %s does not exist", id)
	}

	var socibAsset SocibHFRadarAsset
	err = json.Unmarshal(socibAssetJSON, &socibAsset)
	if err != nil {
		return nil, err
	}

	return &socibAsset, nil
}

// TODO: Transfer is basically update
// UpdateAsset updates an existing asset in the world state with provided parameters.
func (s *SmartContract) UpdateSocibAsset(ctx contractapi.TransactionContextInterface, id, owner, fileHash, fileUniqueID, fileCreationTime string, commonVariables string, longitude, latitude string, time string, mean, min, max, standardDeviation string, numberOfSeries, softwareVersion int, links string) error {
	exists, err := s.SocibAssetExists(ctx, id)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("the asset %s does not exist", id)
	}

	// overwriting original asset with new asset
	// Create the SocibHFRadarAsset instance
	socibAsset := SocibHFRadarAsset{
		ID:                id,
		Owner:             owner,
		FileHash:          fileHash,
		FileUniqueID:      fileUniqueID,
		FileCreationTime:  fileCreationTime,
		CommonVariables:   commonVariables,
		Longitude:         longitude,
		Latitude:          latitude,
		Time:              time,
		Mean:              mean,
		Min:               min,
		Max:               max,
		StandardDeviation: standardDeviation,
		NumberOfSeries:    numberOfSeries,
		SoftwareVersion:   softwareVersion,
		Links:             links,
	}
	socibAssetJSON, err := json.Marshal(socibAsset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, socibAssetJSON)
}

// DeleteAsset deletes an given asset from the world state.
func (s *SmartContract) DeleteSocibAsset(ctx contractapi.TransactionContextInterface, id string) error {
	exists, err := s.SocibAssetExists(ctx, id)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("the asset %s does not exist", id)
	}

	return ctx.GetStub().DelState(id)
}

// TransferAsset updates the owner field of asset with given id in world state, and returns the old owner.
func (s *SmartContract) TransferSocibAsset(ctx contractapi.TransactionContextInterface, id string, newOwner string) (string, error) {
	socibAsset, err := s.ReadSocibAsset(ctx, id)
	if err != nil {
		return "", err
	}

	oldOwner := socibAsset.Owner
	socibAsset.Owner = newOwner

	socibAssetJSON, err := json.Marshal(socibAsset)
	if err != nil {
		return "", err
	}

	err = ctx.GetStub().PutState(id, socibAssetJSON)
	if err != nil {
		return "", err
	}

	return oldOwner, nil
}

// GetAllAssets returns all assets found in world state
func (s *SmartContract) GetAllSocibAssets(ctx contractapi.TransactionContextInterface) ([]*SocibHFRadarAsset, error) {
	// range query with empty string for startKey and endKey does an
	// open-ended query of all assets in the chaincode namespace.
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var socibAssets []*SocibHFRadarAsset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var socibAsset SocibHFRadarAsset
		err = json.Unmarshal(queryResponse.Value, &socibAsset)
		if err != nil {
			return nil, err
		}
		socibAssets = append(socibAssets, &socibAsset)
	}

	return socibAssets, nil
}

func (t *SmartContract) GetSocibAssetsByRange(ctx contractapi.TransactionContextInterface, startKey, endKey string) ([]*SocibHFRadarAsset, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var socibAssets []*SocibHFRadarAsset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var socibAsset SocibHFRadarAsset
		err = json.Unmarshal(queryResponse.Value, &socibAsset)
		if err != nil {
			return nil, err
		}
		socibAssets = append(socibAssets, &socibAsset)
	}

	return socibAssets, nil
}

// GetAssetHistory returns the chain of custody for an asset since issuance.
func (t *SmartContract) GetSocibAssetHistory(ctx contractapi.TransactionContextInterface, assetID string) ([]SocibHistoryQueryResult, error) {
	log.Printf("GetAssetHistory: ID %v", assetID)

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(assetID)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []SocibHistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var socibAsset SocibHFRadarAsset
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &socibAsset)
			if err != nil {
				return nil, err
			}
		} else {
			socibAsset = SocibHFRadarAsset{
				ID: assetID,
			}
		}

		timestamp, err := ptypes.Timestamp(response.Timestamp)
		if err != nil {
			return nil, err
		}

		record := SocibHistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: timestamp,
			Record:    &socibAsset,
			IsDelete:  response.IsDelete,
		}
		records = append(records, record)
	}

	return records, nil
}
