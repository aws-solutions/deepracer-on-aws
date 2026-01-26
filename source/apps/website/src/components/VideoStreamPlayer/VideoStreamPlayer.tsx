// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Hls from 'hls.js';
import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { displayErrorNotification } from '#store/notifications/notificationsSlice.js';

import './styles.css';

interface VideoStreamPlayerProps {
  src: string;
}

interface VideoStreamPlayerRefHandle {
  readonly player: Hls | undefined;
  readonly videoElement: HTMLVideoElement | null;
}

/**
 * This component is a wrapper around `hls.js` and is intended for playing HLS video streams (ie. Kinesis Video Streams).
 */
const VideoStreamPlayer = forwardRef<VideoStreamPlayerRefHandle, VideoStreamPlayerProps>(({ src }, ref) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');

  const videoRef = useRef<HTMLVideoElement>(null);
  const [player, setPlayer] = useState<Hls>();

  // Creates an HLS.js player instance on mount and destroys the instance on unmount.
  useEffect(() => {
    const initPlayer = (mediaElement: HTMLVideoElement) => {
      if (Hls.isSupported()) {
        const hlsPlayer = new Hls();
        hlsPlayer.loadSource(src);
        hlsPlayer.attachMedia(mediaElement);

        // Handle errors
        hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Unexpected network error, trying to recover');
                hlsPlayer.startLoad();
                // Don't show notification for network errors (404, etc.) which could be misleading when 404 is returned after stream is not available
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Media error, trying to recover.');
                hlsPlayer.recoverMediaError();
                break;
              default:
                console.log('Fatal error, cannot recover');
                dispatch(
                  displayErrorNotification({
                    header: t('videoPlayer.playError'),
                    content: data.details || 'Video playback error',
                  }),
                );
                break;
            }
          }
        });

        // Handle manifest loaded
        hlsPlayer.on(Hls.Events.MANIFEST_LOADED, () => {
          console.debug('Video player manifest loaded successfully');
        });

        setPlayer(hlsPlayer);
      } else if (mediaElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native support (Safari)
        mediaElement.setAttribute('src', src);
        mediaElement.addEventListener('error', (e) => {
          console.log('Native video error');
          // Suppress error notifications for native video errors (404, etc.)
        });
      } else {
        dispatch(
          displayErrorNotification({
            header: t('videoPlayer.loadError'),
            content: 'Video player is not supported in this browser',
          }),
        );
      }
    };

    if (!player && videoRef.current) {
      initPlayer(videoRef.current);
    }

    return () => {
      player?.destroy();
    };
  }, [dispatch, player, src, t]);

  // Define a handle for easily referencing Shaka's player API
  useImperativeHandle(
    ref,
    () => ({
      get player() {
        return player;
      },
      get videoElement() {
        return videoRef.current;
      },
    }),
    [player],
  );

  return <video autoPlay controls className="videoStreamPlayer" data-testid="video-stream-player" ref={videoRef} />;
});

export default VideoStreamPlayer;
