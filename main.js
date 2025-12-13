const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const WebSocket = require('ws')
const fetch = require('node-fetch')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.ws = null
		this.reconnectTimer = null
		this.mediaStatus = {
			connected: false,
			appName: null,
			isPlaying: false,
			track: null,
		}
	}

	async init(config) {
		this.config = config

		this.updateStatus(InstanceStatus.Connecting)

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions

		this.connectWebSocket()
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.ws) {
			this.ws.close()
			this.ws = null
		}
	}

	async configUpdated(config) {
		this.config = config
		// Reconnect with new config
		if (this.ws) {
			this.ws.close()
		}
		this.connectWebSocket()
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				default: 'localhost',
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				default: '6262',
				regex: Regex.PORT,
			},
		]
	}

	connectWebSocket() {
		const host = this.config.host || 'localhost'
		const port = this.config.port || '6262'
		const url = `ws://${host}:${port}/ws`

		this.log('info', `Connecting to ${url}`)

		try {
			this.ws = new WebSocket(url)

			this.ws.on('open', () => {
				this.log('info', 'WebSocket connected')
				this.updateStatus(InstanceStatus.Ok)
				if (this.reconnectTimer) {
					clearTimeout(this.reconnectTimer)
					this.reconnectTimer = null
				}
			})

			this.ws.on('message', (data) => {
				try {
					const message = JSON.parse(data.toString())
					this.handleWebSocketMessage(message)
				} catch (error) {
					this.log('error', `Error parsing WebSocket message: ${error.message}`)
				}
			})

			this.ws.on('error', (error) => {
				this.log('error', `WebSocket error: ${error.message}`)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})

			this.ws.on('close', () => {
				this.log('warn', 'WebSocket disconnected')
				this.updateStatus(InstanceStatus.Disconnected)
				this.ws = null

				// Attempt to reconnect after 5 seconds
				if (!this.reconnectTimer) {
					this.reconnectTimer = setTimeout(() => {
						this.reconnectTimer = null
						this.connectWebSocket()
					}, 5000)
				}
			})
		} catch (error) {
			this.log('error', `Error creating WebSocket: ${error.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		}
	}

	handleWebSocketMessage(message) {
		if (!message.event || !message.data) {
			return
		}

		switch (message.event) {
			case 'track_changed':
				this.mediaStatus.track = {
					title: message.data.title || '',
					artist: message.data.artist || '',
					album: message.data.album || '',
					duration: message.data.duration || 0,
					artwork: message.data.artwork || null,
					appName: message.data.appName || '',
				}
				this.updateVariables()
				this.checkFeedbacks()
				break

			case 'playback_state_changed':
				this.mediaStatus.isPlaying = message.data.isPlaying
				if (message.data.position !== undefined) {
					if (this.mediaStatus.track) {
						this.mediaStatus.track.position = message.data.position
					}
				}
				this.updateVariables()
				this.checkFeedbacks()
				break

			case 'connection_status':
				this.mediaStatus.connected = message.data.connected
				this.mediaStatus.appName = message.data.appName || null
				if (!message.data.connected) {
					// Clear track info when disconnected
					this.mediaStatus.track = null
				}
				this.updateVariables()
				this.checkFeedbacks()
				break

			default:
				this.log('debug', `Unknown WebSocket event: ${message.event}`)
		}
	}

	updateVariables() {
		const vars = {}

		// Connection status
		vars.connected = this.mediaStatus.connected ? 'Yes' : 'No'
		vars.appName = this.mediaStatus.appName || 'N/A'
		vars.isPlaying = this.mediaStatus.isPlaying ? 'Playing' : 'Paused'

		// Track info
		if (this.mediaStatus.track) {
			vars.title = this.mediaStatus.track.title || 'N/A'
			vars.artist = this.mediaStatus.track.artist || 'N/A'
			vars.album = this.mediaStatus.track.album || 'N/A'
			vars.artwork = this.mediaStatus.track.artwork || ''

			// Format duration
			const duration = Math.floor(this.mediaStatus.track.duration / 1000)
			const durationMins = Math.floor(duration / 60)
			const durationSecs = duration % 60
			vars.duration = `${durationMins}:${durationSecs.toString().padStart(2, '0')}`

			// Format position
			const position = Math.floor((this.mediaStatus.track.position || 0) / 1000)
			const positionMins = Math.floor(position / 60)
			const positionSecs = position % 60
			vars.position = `${positionMins}:${positionSecs.toString().padStart(2, '0')}`
		} else {
			vars.title = 'N/A'
			vars.artist = 'N/A'
			vars.album = 'N/A'
			vars.artwork = ''
			vars.duration = '0:00'
			vars.position = '0:00'
		}

		this.setVariableValues(vars)
	}

	async sendCommand(endpoint) {
		const host = this.config.host || 'localhost'
		const port = this.config.port || '6262'
		const url = `http://${host}:${port}${endpoint}`

		try {
			const response = await fetch(url, { method: 'POST' })
			const data = await response.json()

			if (!data.success) {
				this.log('warn', `Command failed: ${data.error || 'Unknown error'}`)
			}

			return data
		} catch (error) {
			this.log('error', `Error sending command: ${error.message}`)
			throw error
		}
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
