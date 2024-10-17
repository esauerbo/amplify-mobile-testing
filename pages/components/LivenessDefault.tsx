import { useState } from 'react';
import { View, Flex, Loader, Text } from '@aws-amplify/ui-react';
import { FaceLivenessDetectorCore } from '@aws-amplify/ui-react-liveness';
import { useLiveness } from '../hooks/useLiveness';
import { SessionIdAlert } from './SessionIdAlert';
import { ConfigSelect } from './ConfigSelect';
import LivenessInlineResults from './LivenessInlineResults';
import { LIVENESS_COMPONENT, recordAnalyticsEvent } from '../utils/analytics';
import { fetchAuthSession } from 'aws-amplify/auth';

const credentialProvider = async () => {
  const { credentials } = await fetchAuthSession();
  if (!credentials) {
    throw new Error('No credentials provided');
  }
  return credentials;
};

const DEFAULT_CHALLENGE = 'FaceMovementAndLightChallenge';
const SUPPORTED_CHALLENGES = [
  'FaceMovementAndLightChallenge',
  'FaceMovementChallenge',
];

export default function LivenessDefault({ disableStartScreen = false }) {
  const [challengeType, setChallengeType] = useState(DEFAULT_CHALLENGE);

  const {
    getLivenessResponse,
    createLivenessSessionApiError,
    createLivenessSessionApiData,
    createLivenessSessionApiLoading,
    handleGetLivenessDetection,
    stopLiveness,
    isResultModalOpen,
    handleResultsModalClose,
  } = useLiveness(challengeType);

  const [error, setError] = useState(undefined);

  if (createLivenessSessionApiError) {
    return <div>Some error occured...</div>;
  }

  function onUserCancel() {
    stopLiveness();
    setError(undefined);
    recordAnalyticsEvent({
      event: LIVENESS_COMPONENT,
      attributes: { action: 'Cancelled' },
      metrics: { count: 1 },
    });
  }

  const onRetry = () => {
    setError(undefined);
    stopLiveness();
    recordAnalyticsEvent({
      event: LIVENESS_COMPONENT,
      attributes: { action: 'Retry' },
      metrics: { count: 1 },
    });
  };

  const onError = (error) => {
    console.error(error);
    setError(error);
    recordAnalyticsEvent({
      event: LIVENESS_COMPONENT,
      attributes: { action: 'Error', errorName: error.name },
      metrics: { count: 1 },
    });
  };

  const getLivenessDetectionHandler = async () => {
    const response = await handleGetLivenessDetection(
      createLivenessSessionApiData['sessionId']
    );
    if (!response.isLive) {
      recordAnalyticsEvent({
        event: LIVENESS_COMPONENT,
        attributes: { action: 'Failure' },
        metrics: { count: 1 },
      });
    } else {
      recordAnalyticsEvent({
        event: LIVENESS_COMPONENT,
        attributes: { action: 'Success' },
        metrics: { count: 1 },
      });
    }
  };

  return (
    <View maxWidth="640px" margin="0 auto">
      {createLivenessSessionApiLoading ? (
        <Flex justifyContent="center" alignItems="center">
          <Loader /> <Text as="span">Loading...</Text>
        </Flex>
      ) : (
        <Flex direction="column" position="relative" style={{ zIndex: '2' }}>
          <ConfigSelect
            name="Challenge"
            currentSelection={challengeType}
            onChange={setChallengeType}
            options={SUPPORTED_CHALLENGES}
          />
          <SessionIdAlert
            sessionId={createLivenessSessionApiData['sessionId']}
          />
          {!!getLivenessResponse ? (
            <LivenessInlineResults
              getLivenessResponse={getLivenessResponse}
              onUserCancel={onUserCancel}
            />
          ) : null}

          <Flex direction="column" gap="0" position="relative">
            {!getLivenessResponse ? (
              <FaceLivenessDetectorCore
                sessionId={createLivenessSessionApiData['sessionId']}
                region={'us-east-1'}
                onUserCancel={onUserCancel}
                onAnalysisComplete={getLivenessDetectionHandler}
                disableStartScreen={disableStartScreen}
                onError={onError}
                config={{
                  ...(credentialProvider ? { credentialProvider } : {}),
                  endpointOverride:
                    'wss://streaming-rekognition-gamma.us-east-1.amazonaws.com',
                }}
              />
            ) : null}
          </Flex>
        </Flex>
      )}
    </View>
  );
}
