module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'connected', name: 'Connection Status' },
		{ variableId: 'appName', name: 'Media App Name' },
		{ variableId: 'isPlaying', name: 'Playback State' },
		{ variableId: 'title', name: 'Track Title' },
		{ variableId: 'artist', name: 'Artist Name' },
		{ variableId: 'album', name: 'Album Name' },
		{ variableId: 'duration', name: 'Track Duration' },
		{ variableId: 'position', name: 'Playback Position' },
	])
}
