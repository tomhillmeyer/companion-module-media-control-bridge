const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		isPlaying: {
			name: 'Is Playing',
			type: 'boolean',
			label: 'Change button style when media is playing',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: () => {
				return self.mediaStatus.isPlaying === true
			},
		},
		isPaused: {
			name: 'Is Paused',
			type: 'boolean',
			label: 'Change button style when media is paused',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.mediaStatus.isPlaying === false
			},
		},
		isConnected: {
			name: 'Media App Connected',
			type: 'boolean',
			label: 'Change button style when a media app is connected',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 255),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.mediaStatus.connected === true
			},
		},
		isDisconnected: {
			name: 'Media App Disconnected',
			type: 'boolean',
			label: 'Change button style when no media app is connected',
			defaultStyle: {
				bgcolor: combineRgb(64, 64, 64),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.mediaStatus.connected === false
			},
		},
		albumArtwork: {
			name: 'Album Artwork',
			type: 'advanced',
			label: 'Display album artwork on button',
			options: [],
			callback: async () => {
				if (self.mediaStatus.track && self.mediaStatus.track.artwork) {
					try {
						const fetch = require('node-fetch')
						const response = await fetch(self.mediaStatus.track.artwork)
						const buffer = await response.buffer()
						return {
							png64: buffer.toString('base64'),
						}
					} catch (error) {
						self.log('error', `Error fetching album artwork: ${error.message}`)
						return {}
					}
				}
				return {}
			},
		},
	})
}
