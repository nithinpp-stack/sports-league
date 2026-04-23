import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tournament name is required'],
      trim: true,
    },
    sport: {
      type: String,
      enum: ['cricket', 'football', 'badminton'],
      default: 'cricket',
    },
    format: {
      type: String,
      required: [true, 'Format is required'],
      validate: {
        validator: function (value) {
          const validFormats = {
            cricket: ['T20', 'ODI', 'Test'],
            football: ['League', 'Cup', 'Friendly'],
            // BWF formats; legacy Singles/Doubles/Mixed Doubles retained for back-compat
            badminton: ['Knockout', 'Round Robin', 'Group + Knockout', 'Double Elimination', 'Singles', 'Doubles', 'Mixed Doubles'],
          };
          const sport = this.sport || 'cricket';
          return (validFormats[sport] || validFormats.cricket).includes(value);
        },
        message: function (props) {
          const sport = props.instance ? props.instance.sport || 'cricket' : 'cricket';
          const validFormats = {
            cricket: ['T20', 'ODI', 'Test'],
            football: ['League', 'Cup', 'Friendly'],
            // BWF formats; legacy Singles/Doubles/Mixed Doubles retained for back-compat
            badminton: ['Knockout', 'Round Robin', 'Group + Knockout', 'Double Elimination', 'Singles', 'Doubles', 'Mixed Doubles'],
          };
          const formats = (validFormats[sport] || validFormats.cricket).join(', ');
          return `Format must be one of: ${formats}`;
        },
      },
    },
    location: {
      type: String,
    },
    venue: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['draft', 'registration', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    maxTeams: {
      type: Number,
      default: 8,
    },
    description: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Creator is required'],
    },
  },
  { timestamps: true }
);

tournamentSchema.index({ status: 1 });
tournamentSchema.index({ createdBy: 1 });

const Tournament = mongoose.model('Tournament', tournamentSchema);
export default Tournament;
