import React from 'react';

const COLORS = {
    bg: '#000000',
    white: '#FFFFFF',
    grey: '#888888',
    pink: '#FF2D55',
    blue: '#007AFF',
    green: '#34C759', // Added for success/tickets
};

// ─── Standard Dashed Box ─────────────────────────────────────────────────────
const DashedBox = ({ children, style = {} }) => (
    <div style={{
        border: `1px dashed ${COLORS.white}`,
        padding: '16px 32px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'transparent',
        maxWidth: '350px',
        textAlign: 'center',
        ...style
    }}>
        {children}
    </div>
);

// ─── Down Arrow (Solid Line, Hollow Head) ────────────────────────────────────
const DownArrow = ({ height = 40, solid = true }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
            width: '1px',
            height: `${height}px`,
            borderLeft: `1px ${solid ? 'solid' : 'dashed'} ${COLORS.white}`
        }} />
        <div style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${COLORS.white}`,
            marginTop: '-1px'
        }} />
    </div>
);

// ─── Plain Dashed Down Arrow ─────────────────────────────────────────────────
const PlainDownArrow = ({ height = 40 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
            width: '1px',
            height: `${height}px`,
            borderLeft: `1px dashed ${COLORS.white}`
        }} />
        <div style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${COLORS.white}`,
            marginTop: '-1px'
        }} />
    </div>
);

export default function FullJourneyFlowChart() {
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: COLORS.bg,
            color: COLORS.white,
            fontFamily: "'Courier New', Courier, monospace",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '80px 20px',
            fontSize: '14px',
            lineHeight: '1.4'
        }}>

            {/* ======================================= */}
            {/* 1. PRE-PAYMENT PHASE                    */}
            {/* ======================================= */}
            <DashedBox>Customer visits your website</DashedBox>
            <DownArrow />

            <DashedBox>Customer selects event</DashedBox>
            <DownArrow />

            <DashedBox>Customer chooses ticket and quantity</DashedBox>
            <DownArrow />

            <DashedBox>Customer clicks <span style={{ color: COLORS.blue }}>"Buy Ticket"</span></DashedBox>
            <DownArrow />

            <DashedBox>Customer goes to secure Stripe Checkout page</DashedBox>
            <DownArrow />


            {/* ======================================= */}
            {/* 2. THE PAYMENT & SPLIT (Core specific)  */}
            {/* ======================================= */}
            <DashedBox style={{ borderColor: COLORS.pink }}>
                <div>Customer enters card details</div>
                <div>
                    and pays <span style={{ color: COLORS.grey }}>$100</span>
                </div>
            </DashedBox>

            <DownArrow height={30} />

            <DashedBox style={{ borderColor: COLORS.pink }}>
                <div>Stripe processes the payment</div>
                <div style={{ color: COLORS.grey }}>(PaymentIntent)</div>
            </DashedBox>

            {/* Drop down to the split */}
            <div style={{
                width: '1px',
                height: '30px',
                borderLeft: `1px dashed ${COLORS.white}`
            }} />

            {/* Horizontal Split Line */}
            <div style={{
                width: '100%',
                maxWidth: '800px',
                height: '1px',
                backgroundColor: COLORS.white,
                position: 'relative',
                display: 'flex',
                justifyContent: 'space-between'
            }}>
                {/* Left Arrow */}
                <div style={{ position: 'absolute', left: '15%', top: 0 }}>
                    <PlainDownArrow height={30} />
                </div>

                {/* Center Arrow */}
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 0 }}>
                    <PlainDownArrow height={30} />
                </div>

                {/* Right Arrow */}
                <div style={{ position: 'absolute', right: '15%', top: 0 }}>
                    <PlainDownArrow height={30} />
                </div>
            </div>

            {/* The 3 Columns */}
            <div style={{ marginTop: '30px', width: '100%', maxWidth: '800px', display: 'flex' }}>

                {/* Left Column: Stripe Fee */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div>Stripe Processing Fee</div>
                    <div style={{ marginTop: '8px' }}>
                        <span style={{ color: COLORS.grey }}>$3</span>
                        <span style={{ color: COLORS.pink }}>.20</span>
                    </div>
                    <div style={{ marginTop: '4px' }}>
                        (<span style={{ color: COLORS.pink }}>2.9</span>% + $<span style={{ color: COLORS.pink }}>0.30</span>)
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <PlainDownArrow height={30} />
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <div>Stripe</div>
                        <div>
                            keeps $3<span style={{ color: COLORS.pink }}>.20</span>
                        </div>
                    </div>
                </div>

                {/* Center Column: Platform Fee */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div>Platform Fee</div>
                    <div style={{ marginTop: '8px' }}>
                        <span style={{ color: COLORS.grey }}>$10</span>
                        <span style={{ color: COLORS.pink }}>.00</span>
                    </div>
                    <div style={{ marginTop: '4px', color: COLORS.grey }}>
                        (Application Fee)
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <PlainDownArrow height={30} />
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <div>Your Platform</div>
                        <div>
                            receives $10<span style={{ color: COLORS.pink }}>.00</span>
                        </div>
                        <div>
                            minus $3<span style={{ color: COLORS.pink }}>.20</span>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            = $6<span style={{ color: COLORS.pink }}>.80</span> net profit
                        </div>
                    </div>
                </div>

                {/* Right Column: Merchant Transfer */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div>Merchant/Organizer</div>
                    <div style={{ marginTop: '8px' }}>
                        <span style={{ color: COLORS.grey }}>$90</span>
                        <span style={{ color: COLORS.pink }}>.00</span>
                    </div>
                    <div style={{ marginTop: '4px' }}>
                        (<span style={{ color: COLORS.blue }}>to</span> Connected Account)
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <PlainDownArrow height={30} />
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <div>Organizer</div>
                        <div>
                            receives $90<span style={{ color: COLORS.pink }}>.00</span>
                        </div>
                    </div>
                </div>

            </div>


            {/* ======================================= */}
            {/* 3. POST-PAYMENT PHASE                   */}
            {/* ======================================= */}

            {/* Long arrow dropping from beneath the center column to reconnect the flow */}
            <div style={{ marginTop: '40px' }}>
                <DownArrow height={60} />
            </div>

            <DashedBox style={{ borderColor: COLORS.green }}>
                Payment confirmed successfully
            </DashedBox>
            <DownArrow />

            <DashedBox>Ticket Tailor creates the ticket</DashedBox>
            <DownArrow />

            <DashedBox>Ticket Tailor generates QR code and ticket PDF</DashedBox>
            <DownArrow />

            <DashedBox>Ticket Tailor sends email to customer</DashedBox>
            <DownArrow />

            <DashedBox style={{ borderColor: COLORS.blue }}>
                Customer receives ticket in email with QR code
            </DashedBox>
            <DownArrow />

            <DashedBox style={{ borderColor: COLORS.green }}>
                Customer uses ticket to attend event
            </DashedBox>

            {/* Footer spacer */}
            <div style={{ height: '80px' }} />
        </div>
    );
}
